// server.js
import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---- Helpers ---------------------------------------------------------

// Only allow Zoho picklist values for Follow-up Status
function normalizeFollowUpStatus(aiStatus) {
  if (!aiStatus) return "No Commitment Found";

  const s = String(aiStatus).toLowerCase();

  // Explicit matches
  if (s.includes("follow-up completed") || s.includes("follow up completed") || s.includes("completed")) {
    return "Follow-up Completed";
  }
  if (s.includes("delayed")) {
    return "Delayed Follow-up";
  }
  if (s.includes("missed")) {
    return "Missed Follow-up";
  }

  // Variants of "no follow-up required"
  if (s.includes("no follow-up required") ||
      s.includes("no follow up required") ||
      s.includes("no follow-up needed") ||
      s.includes("no follow up needed") ||
      s.includes("not required") ||
      s.includes("no commitment")) {
    return "No Commitment Found";
  }

  // Safe default
  return "No Commitment Found";
}

// Build the prompt sent to OpenAI
function buildPrompt(payload) {
  const subject = payload.subject || "N/A";
  const channel = payload.channel || "N/A";
  const ticketId = payload.ticket_id || "N/A";
  const conversation = payload.conversation || "";

  return `
You are an expert QA and coaching assistant for a VoIP / Support team.

You will receive the FULL conversation of a Zoho Desk ticket, including:
- ticket subject
- channel
- user and agent messages
- internal notes

Your job is to:
1. Classify **follow-up status** into one of these 4 values:
   - "Follow-up Completed"
   - "Delayed Follow-up"
   - "Missed Follow-up"
   - "No Follow-up Required"
2. Score the ticket from 1–10 on:
   - follow_up_frequency
   - no_drops
   - sla_adherence
   - resolution_quality
   - customer_sentiment
   - agent_tone
3. Provide a short **reason** text for each score.
4. Provide:
   - overall category (e.g. "Technical Support", "How-To / Configuration / Settings", etc.)
   - subcategory (e.g. "VoIP Call Flow Configuration", "Training on call flow / IVR setup", etc.)
   - final_score (1–10)
   - overall explanation/reasons (2–4 sentences).

CRITICAL:
- Respond with **ONLY valid JSON**, no backticks, no markdown.
- Use this exact JSON shape:

{
  "title": "string",
  "follow_up_status": "one of: Follow-up Completed, Delayed Follow-up, Missed Follow-up, No Follow-up Required",
  "category": "string",
  "subcategory": "string",
  "scores": {
    "follow_up_frequency": 0,
    "no_drops": 0,
    "sla_adherence": 0,
    "resolution_quality": 0,
    "customer_sentiment": 0,
    "agent_tone": 0
  },
  "score_reasons": {
    "follow_up_frequency": "string",
    "no_drops": "string",
    "sla_adherence": "string",
    "resolution_quality": "string",
    "customer_sentiment": "string",
    "agent_tone": "string"
  },
  "final_score": 0,
  "reasons": "string"
}

Conversation context:

Ticket ID: ${ticketId}
Subject: ${subject}
Channel: ${channel}

Full conversation & notes:
${conversation}
`;
}

// Call OpenAI
async function callOpenAI(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY env var");
  }

  const prompt = buildPrompt(payload);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are a concise, JSON-only scoring assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    console.error("OpenAI error:", data);
    throw new Error("OpenAI API error");
  }

  const content = data.choices?.[0]?.message?.content || "";
  console.log("Raw OpenAI content:", content);

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse OpenAI JSON, returning fallback:", e);
    throw new Error("OpenAI returned invalid JSON");
  }

  return parsed;
}

// Call Zoho Desk to update ticket custom fields
async function updateZohoDeskTicket(ticketId, ai) {
  const baseUrl = process.env.DESK_BASE_URL || "https://desk.zoho.com/api/v1";
  const orgId = process.env.DESK_ORG_ID;
  const oauth = process.env.DESK_OAUTH_TOKEN;

  if (!orgId || !oauth) {
    throw new Error("Missing DESK_ORG_ID or DESK_OAUTH_TOKEN env vars");
  }

  const scores = ai.scores || {};
  const reasons = ai.score_reasons || {};

  // Map AI → Zoho Desk custom fields (display names)
  const customFields = {
    // high-level classification
    "AI Category": ai.category || "",
    "AI Sub Category": ai.subcategory || "",
    "AI Category explanation": ai.reasons || "",
    "AI Final Score": ai.final_score || null,

    // follow-up picklist (normalized)
    "Follow-up Status": normalizeFollowUpStatus(ai.follow_up_status),

    // numeric scores
    "Follow-Up Frequency": scores.follow_up_frequency ?? null,
    "No Drops Score": scores.no_drops ?? null,
    "SLA Adherence": scores.sla_adherence ?? null,
    "Resolution Quality": scores.resolution_quality ?? null,
    "Customer Sentiment": scores.customer_sentiment ?? null,
    "Agent Tone": scores.agent_tone ?? null,

    // reasons for each score
    "Reason Follow-Up Frequency": reasons.follow_up_frequency || "",
    "Reason No Drops": reasons.no_drops || "",
    "Reasons SLA Adherence": reasons.sla_adherence || "",
    "Reason Resolution Quality": reasons.resolution_quality || "",
    "Reason Customer Sentiment": reasons.customer_sentiment || "",
    "Reason Agent Tone": reasons.agent_tone || "",
  };

  // Clean null/empty-only fields (Zoho gets grumpy with undefined)
  Object.keys(customFields).forEach((k) => {
    const v = customFields[k];
    if (v === undefined) delete customFields[k];
  });

  const body = {
    customFields,
  };

  const url = `${baseUrl}/tickets/${ticketId}`;

  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      orgId: orgId,
      Authorization: `Zoho-oauthtoken ${oauth}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  return { status: resp.status, data };
}

// ---- Routes -----------------------------------------------------------

app.get("/", (_req, res) => {
  res.send("✅ Railway app is live!");
});

app.post("/desk-webhook", async (req, res) => {
  try {
    // 1) Verify shared secret
    const headerSecret =
      req.headers["desk-shared-secret"] ||
      req.headers["desk_shared_secret"] ||
      req.headers["x-desk-signature"];

    if (!process.env.DESK_SHARED_SECRET) {
      console.error("Missing DESK_SHARED_SECRET env var");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    if (!headerSecret || headerSecret !== process.env.DESK_SHARED_SECRET) {
      console.warn("Unauthorized webhook: bad or missing secret", headerSecret);
      return res.status(403).json({ error: "Unauthorized" });
    }

    const payload = req.body || {};
    console.log("Webhook hit (truncated):", JSON.stringify(payload).slice(0, 2000));

    const ticketId = payload.ticket_id;
    if (!ticketId) {
      return res.status(400).json({ error: "ticket_id missing in payload" });
    }

    // 2) Call OpenAI to score / classify
    const ai = await callOpenAI(payload);
    console.log("AI result:", JSON.stringify(ai));

    // 3) Update Zoho Desk custom fields
    let deskResult = null;
    try {
      deskResult = await updateZohoDeskTicket(ticketId, ai);
      console.log("Desk update response:", JSON.stringify(deskResult).slice(0, 2000));
    } catch (deskErr) {
      console.error("Zoho Desk update failed:", deskErr);
      deskResult = { status: 500, data: { error: String(deskErr) } };
    }

    // 4) Respond back so Deluge can log it
    res.json({
      ok: true,
      ai,
      desk: deskResult,
    });
  } catch (err) {
    console.error("Error in /desk-webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---- Start server -----------------------------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
