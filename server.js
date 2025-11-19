// server.js

import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

// ---- ENV VARS ----------------------------------------------------
const PORT               = process.env.PORT || 8080;
const DESK_SHARED_SECRET = process.env.DESK_SHARED_SECRET;
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY;
const ZOHO_ORG_ID        = process.env.ZOHO_ORG_ID;
const ZOHO_ACCESS_TOKEN  = process.env.ZOHO_ACCESS_TOKEN;

if (!DESK_SHARED_SECRET) console.warn("⚠️ DESK_SHARED_SECRET is not set");
if (!OPENAI_API_KEY)     console.warn("⚠️ OPENAI_API_KEY is not set");
if (!ZOHO_ORG_ID)        console.warn("⚠️ ZOHO_ORG_ID is not set");
if (!ZOHO_ACCESS_TOKEN)  console.warn("⚠️ ZOHO_ACCESS_TOKEN is not set");

// ---- HEALTH CHECK ------------------------------------------------
app.get("/", (_req, res) => {
  res.send("✅ Railway app is live!");
});

// ---- OPENAI ANALYSIS ---------------------------------------------
async function analyzeTicket(conversationText) {
  const systemPrompt = `
You are an assistant that evaluates support tickets.

Return STRICT JSON with this exact shape:

{
  "title": string,
  "follow_up_status": "Follow-up Needed" | "Follow-up Completed" | "No Follow-up Required",
  "category": string,
  "subcategory": string,
  "scores": {
    "follow_up_frequency": number,
    "no_drops": number,
    "sla_adherence": number,
    "resolution_quality": number,
    "customer_sentiment": number,
    "agent_tone": number
  },
  "score_reasons": {
    "follow_up_frequency": string,
    "no_drops": string,
    "sla_adherence": string,
    "resolution_quality": string,
    "customer_sentiment": string,
    "agent_tone": string
  },
  "final_score": number,
  "reasons": string
}

Rules:
- All scores are from 0–10.
- "score_reasons" must contain a short reason *specific* to that score.
- ONLY output raw JSON. No markdown, no extra text.
`;

  const userPrompt = `Here is the ticket transcript:\n\n${conversationText}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "{}";

  let ai;
  try {
    ai = JSON.parse(content);
  } catch (e) {
    console.error("❌ Failed to parse AI JSON:", content);
    throw e;
  }

  console.log(
    "AI result:",
    JSON.stringify(ai, null, 2).slice(0, 4000) // avoid huge logs
  );
  return ai;
}

// ---- MAP AI → ZOHO DESK CUSTOM FIELDS ----------------------------
function buildDeskCf(ai) {
  const scores       = ai.scores || {};
  const scoreReasons = ai.score_reasons || {};

  const cf = {};

  // High-level AI fields
  cf.cf_ai_category_1           = ai.category || null;
  cf.cf_ai_sub_category         = ai.subcategory || null;
  cf.cf_follow_up_status        = ai.follow_up_status || null;
  cf.cf_ai_final_score          = String(ai.final_score ?? "");
  cf.cf_ai_category_explanation =
    `Follow-up: ${ai.follow_up_status || ""} | Reasons: ${ai.reasons || ""}`;

  // Numeric scores
  cf.cf_follow_up_frequency = scores.follow_up_frequency;
  cf.cf_no_drops_score      = scores.no_drops;
  cf.cf_sla_adherence       = scores.sla_adherence;
  cf.cf_resolution_quality  = scores.resolution_quality;
  cf.cf_customer_sentiment  = scores.customer_sentiment;
  cf.cf_agent_tone          = scores.agent_tone;

  // Per-score reasons (text fields)
  cf.cf_reason_follow_up_frequency = scoreReasons.follow_up_frequency || null;
  cf.cf_reason_no_drops            = scoreReasons.no_drops || null;
  cf.cf_reasons_sla_adherence      = scoreReasons.sla_adherence || null;
  cf.cf_reason_resolution_quality  = scoreReasons.resolution_quality || null;
  cf.cf_reason_customer_sentiment  = scoreReasons.customer_sentiment || null;
  cf.cf_reason_agent_tone          = scoreReasons.agent_tone || null;

  return cf;
}

// ---- UPDATE ZOHO DESK TICKET ------------------------------------
async function updateDeskTicket(ticketId, ai) {
  const cf = buildDeskCf(ai);

  const url = `https://desk.zoho.com/api/v1/tickets/${ticketId}`;

  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      orgId: ZOHO_ORG_ID,
      Authorization: `Zoho-oauthtoken ${ZOHO_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ cf })
  });

  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  console.log("Desk update response:", data);
  return { status: resp.status, data };
}

// ---- WEBHOOK ENDPOINT FROM ZOHO DESK ----------------------------
app.post("/desk-webhook", async (req, res) => {
  try {
    const incomingSecret = req.headers["desk-shared-secret"];

    if (!DESK_SHARED_SECRET) {
      console.error("❌ DESK_SHARED_SECRET env var not configured");
      return res
        .status(500)
        .json({ ok: false, error: "Server secret not configured" });
    }

    if (!incomingSecret || incomingSecret !== DESK_SHARED_SECRET) {
      console.warn("❌ Invalid or missing desk-shared-secret header");
      return res.status(403).json({ ok: false, error: "Unauthorized" });
    }

    console.log(
      "Webhook hit:",
      JSON.stringify(req.body).slice(0, 4000)
    );

    const { ticket_id, conversation } = req.body || {};

    if (!ticket_id || !conversation) {
      console.warn("❌ Missing ticket_id or conversation in payload");
      return res
        .status(400)
        .json({ ok: false, error: "ticket_id and conversation are required" });
    }

    // 1) Call OpenAI to analyze the conversation
    const ai = await analyzeTicket(conversation);

    // 2) Update Zoho Desk ticket with scores + reasons
    const deskUpdate = await updateDeskTicket(ticket_id, ai);

    // 3) Respond to Zoho Desk (your Deluge function)
    return res.json({
      ok: true,
      ai,
      desk: deskUpdate
    });
  } catch (err) {
    console.error("❌ Error handling /desk-webhook:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
      details: err.message
    });
  }
});

// ---- START SERVER -----------------------------------------------
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
