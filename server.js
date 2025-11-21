import express from "express";
import crypto from "crypto";

// Node 18+ has global fetch. If not, uncomment next line:
// import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---- ENV VARS ----
const DESK_SHARED_SECRET = process.env.DESK_SHARED_SECRET;
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY;
const ZOHO_ORG_ID        = process.env.ZOHO_ORG_ID;
const ZOHO_OAUTH_TOKEN   = process.env.ZOHO_OAUTH_TOKEN;

// ---- CATEGORY REFERENCE LIST ----
const REFERENCE_LIST = `Category: Desktop Phones
- Phone not ringing when receiving calls
- Unable to make outbound calls
- Account not registered / logged out
- Keys not responding or malfunctioning
- Phone not powering on / random shutdowns
- Call park not working
- Firmware not updating or stuck update
- Receiver not working / no audio
- Faulty handset or LAN ports
- LAN cable damaged / loose
- Bluetooth headset not connecting
Category: Cordless Phones
- Phone not ringing when receiving calls
- Unable to make outbound calls
- Account not registered / logged out
- Phone goes out of range
- Base station offline or disconnected
- Keys not responding or malfunctioning
- Phone not powering on / random shutdowns
- Call park not working
- Firmware not updating or stuck update
- Receiver not working / no audio
- Faulty handset or LAN ports
- LAN cable damaged / loose
- Bluetooth headset not connecting
Category: How-To / Configuration / Settings
- Training on call flow / IVR setup
- Training on phone features
- Desktop app usage training
- Mobile app usage training
- eFax setup or training
- How to block a caller
- Setting up hold music
- Uploading audio to library
- Multi-location call transfer setup
- Conference call setup
- Enabling patient card
- Enabling call pop-up feature
- Setting up call tracking
- E911 setup and configuration
- Creating multiple voicemail boxes
Category: Software
- Notifications not working
- Voicemail not working / setup issues
- Softphone not working on Desktop
- Softphone not working on Android
- Softphone not working on iOS
- Call park not working on app
- Number assignment errors
- Voicemail access errors
- Update or change label/name
- Wrong practice timezone configuration
- Call flow errors
Category: Product / Carrier Issues
- Need isolation testing
- Whitelisting pending/not done
- Device-specific problems
- Server-related issues
- Carrier issue with Plivo
- Carrier issue with Telnyx
- Porting not completed / failed
- Wrong or broken network configuration
- Receiver failure (audio issues)
- Unable to send or open attachments
Category: Audio Quality – Inbound
- Internet speed too low
- High call latency / delay
- Call fluctuations / instability
- One-way audio (hear only one side)
- Crackling/static noise
- Whitelisting required
- Client expectation not met
Category: Audio Quality – Outbound
- Internet speed too low
- High call latency / delay
- Call fluctuations / instability
- One-way audio (hear only one side)
- Crackling/static noise
- Whitelisting required
- Client expectation not met
Category: Audio Quality – Both Directions
- Internet speed too low
- High call latency / delay
- Call fluctuations / instability
- One-way audio (hear only one side)
- Crackling/static noise
- Whitelisting required
- Client expectation not met
Category: Caller Name / ID
- Receiving spam calls
- Wrong caller name displayed
- Caller ID mismatch
- Need to update label name
Category: General Enquiries
- Request for product information
- Asking for a new feature
- Questions on managing users
- Questions on managing permissions
- Client expectation queries
Category: Custom Fix
- Enable/disable hold reminder tone
- Adjust timezone settings
- Change call waiting tone
- Error during upgrade (timeout)
- Setup speed dials
- Add more call park lines
- Provide a feature-specific workaround
Category: Bugs & Defects
- Mobile app crashing
- Desktop app crashing
- Softphone bugs
- Firmware-related bugs
- Notifications not working
- Unable to answer or hang up calls
- Hardware defect
- Voicemail issues
- Hold music not working
- Audio library not working
- Software glitches
- Call tracking not working
- Call flow not working
- Call override not working
Category: Call Drop
- Network issues causing call drop
- Firmware bug causing call drop
- Whitelisting pending/not done
Category: Installations
- New phone installation
- Replacement phone install
- Partial phone installation
- V3 migration setup
- Bluetooth headset installation`;

// ---- PROMPT (includes owner-change log) ----
const PROMPT = ({
  subject,
  status,
  priority,
  channel,
  department,
  conversation,
  ownerChangeLog,
}) => `
You are an AI Ticket Audit Assistant. Analyze this Zoho Desk ticket for 360° agent performance using only the provided data.
Evaluate follow-ups, tone, resolution quality, and how long the ticket stayed with each team/owner using the Owner Change Log.

1. FOLLOW-UP AUDIT:
Check if the agent promised any callback/follow-up and whether it was completed.
Classify as exactly one of:
- Follow-up Completed
- Delayed Follow-up
- Missed Follow-up
- No Commitment Found
Return as: "follow_up_status": "<one>"

2. CATEGORY & SUBCATEGORY (STRICT):
Use ONLY the Category → Subcategory reference list below.
Do not invent names; pick the closest best match from the list.
Return: "category": "<Category>", "subcategory": "<Subcategory>"

REFERENCE LIST:
${REFERENCE_LIST}

3. SCORING (0–10 each, integers):
- Follow-Up Frequency
- No Drops
- SLA Adherence
- Resolution Quality
- Customer Sentiment (0–10, treat -10..+10 notes as 0..10)
- Agent Tone

Also provide a short 1–2 sentence reason for *each* score:
"score_reasons": {
  "follow_up_frequency": "...",
  "no_drops": "...",
  "sla_adherence": "...",
  "resolution_quality": "...",
  "customer_sentiment": "...",
  "agent_tone": "..."
}

4. FINAL AI TICKET SCORE (0–10 weighted):
- Follow-Up 15%
- No Drops 15%
- SLA 20%
- Resolution 20%
- Sentiment 15%
- Tone 15%

5. OWNER / TEAM TIME REMARK:
From the Owner Change Log, estimate which owner/team handled the ticket the most and how the ownership moved.
You DO NOT need exact hours. A brief summary like
"Most time with VoIP Team, then briefly with Billing; finally closed by Chloe Finn"
is enough.
Return this as: "owner_time_summary": "<short remark>"

Return a single JSON object only, with keys:
{
  "title": "Ticket Follow-up Analysis",
  "follow_up_status": "...",
  "category": "...",
  "subcategory": "...",
  "scores": {
    "follow_up_frequency": 0,
    "no_drops": 0,
    "sla_adherence": 0,
    "resolution_quality": 0,
    "customer_sentiment": 0,
    "agent_tone": 0
  },
  "score_reasons": {
    "follow_up_frequency": "...",
    "no_drops": "...",
    "sla_adherence": "...",
    "resolution_quality": "...",
    "customer_sentiment": "...",
    "agent_tone": "..."
  },
  "final_score": 0,
  "reasons": "one brief paragraph",
  "owner_time_summary": "one short sentence about which team/owner had the ticket longest"
}

Ticket:
Subject: ${subject}
Status: ${status}
Priority: ${priority}
Channel: ${channel}
Department: ${department}
Conversation:
${conversation}

Owner Change Log:
${ownerChangeLog || "(none)"}  
`;

// ---- OpenAI caller ----
async function callOpenAI(prompt) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Only output valid JSON that matches the requested schema. Do not include markdown.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`OpenAI error ${r.status}: ${txt}`);
  }

  const data = await r.json();
  return JSON.parse(data.choices[0].message.content);
}

// ---- Map AI follow-up to allowed picklist ----
function normalizeFollowUpStatus(raw) {
  if (!raw) return null;
  const s = raw.toString().toLowerCase();

  if (s.includes("completed")) return "Follow-up Completed";
  if (s.includes("delayed")) return "Delayed Follow-up";
  if (s.includes("missed")) return "Missed Follow-up";
  if (s.includes("no follow-up required") || s.includes("no commitment"))
    return "No Follow-up Required";

  // fallback
  return "No Commitment Found";
}

// ---- Update Zoho Desk ticket ----
// ---- Update Zoho Desk ticket ----
async function updateDeskTicket(ticketId, aiResult, ownerChangeLog) {
  if (!ZOHO_OAUTH_TOKEN || !ZOHO_ORG_ID) {
    console.warn("ZOHO_OAUTH_TOKEN or ZOHO_ORG_ID missing; skipping Desk update.");
    return { skipped: true };
  }

  const scores       = aiResult.scores || {};
  const scoreReasons = aiResult.score_reasons || {};
  const followUpStatus   = normalizeFollowUpStatus(aiResult.follow_up_status);

  const ownerTimeRemark  = aiResult.owner_time_summary || ""; // <- goes to Remarks-OC Log
  const aiMainSummary    = aiResult.reasons || "";            // <- normal AI summary paragraph

  // 🔹 Brief AI Summary will stay as just the AI explanation text
  const briefSummary = aiMainSummary;

  // ---- CUSTOM FIELDS BY LABEL ----
  const customFields = {
    // MAIN AI LABELS
    "Follow-up Status": followUpStatus,
    "AI Category": aiResult.category || "",
    "AI Sub Category": aiResult.subcategory || "",
    "AI Final Score": aiResult.final_score ?? null,
    "AI Category explanation": briefSummary,   // Brief AI Summary field (no owner time here)

    // NUMERIC SCORES
    "Follow-Up Frequency": scores.follow_up_frequency ?? null,
    "No Drops Score": scores.no_drops ?? null,
    "SLA Adherence": scores.sla_adherence ?? null,
    "Resolution Quality": scores.resolution_quality ?? null,
    "Customer Sentiment": scores.customer_sentiment ?? null,
    "Agent Tone": scores.agent_tone ?? null,

    // PER-SCORE REASONS
    "Reason Follow-Up Frequency": scoreReasons.follow_up_frequency || "",
    "Reason No Drops": scoreReasons.no_drops || "",
    "Reasons SLA Adherence": scoreReasons.sla_adherence || "",
    "Reason Resolution Quality": scoreReasons.resolution_quality || "",
    "Reason Customer Sentiment": scoreReasons.customer_sentiment || "",
    "Reason Agent Tone": scoreReasons.agent_tone || "",

    // ⭐ This is the ONLY place we put the owner-time summary (by label)
    "Remarks-OC Log": ownerTimeRemark,
  };

  // ---- API-NAME FIELDS ----
  const body = {
    customFields,
    cf: {
      // Brief AI Summary – your screenshot API name
      cf_ai_category_explanation: briefSummary,

      // ⭐ Remarks-OC Log – make sure API name matches your field!
      // If your API name is different, adjust this key.
      cf_remarks_oc_log: ownerTimeRemark,

      // keep this if you're still using cf_ts_resolution anywhere, otherwise you can drop it
      cf_ts_resolution: ownerTimeRemark,
    },
  };

  console.log("Desk update payload:", JSON.stringify(body).slice(0, 700));

  const r = await fetch(`https://desk.zoho.com/api/v1/tickets/${ticketId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
      orgId: ZOHO_ORG_ID,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await r.json().catch(() => ({}));
  console.log("Desk update response:", JSON.stringify(data).slice(0, 1200));

  return { status: r.status, data };
}

// ---- Health check ----
app.get("/", (_req, res) => {
  res.send("✅ Railway app is live!");
});

// ---- Webhook ----
app.post("/desk-webhook", async (req, res) => {
  try {
    const secret = req.headers["desk-shared-secret"];
    if (!secret || secret !== DESK_SHARED_SECRET) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const body = req.body || {};
    const {
      ticket_id,
      subject = "N/A",
      status = "N/A",
      priority = "N/A",
      channel = "N/A",
      department = "N/A",
      conversation = "",
      owner_change_log = "",
    } = body;

    console.log(
      "Webhook hit:",
      JSON.stringify({ ticket_id, subject }).slice(0, 300)
    );

    const prompt = PROMPT({
      subject,
      status,
      priority,
      channel,
      department,
      conversation,
      ownerChangeLog: owner_change_log,
    });

    const ai = await callOpenAI(prompt);

    let deskResult = { skipped: true };
    if (ticket_id) {
      deskResult = await updateDeskTicket(ticket_id, ai, owner_change_log);
    } else {
      console.warn("No ticket_id in payload; skipping Desk update.");
    }

    return res.json({ ok: true, ai, desk: deskResult });
  } catch (err) {
    console.error("Webhook error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "Unknown error" });
  }
});

// ---- Start server ----
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
