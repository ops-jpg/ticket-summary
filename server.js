// server.js
import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---- ENV VARS --------------------------------------------------------

const DESK_SHARED_SECRET = process.env.DESK_SHARED_SECRET;
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY;
const DESK_ORG_ID        = process.env.DESK_ORG_ID;
const DESK_OAUTH_TOKEN   = process.env.DESK_OAUTH_TOKEN;
const DESK_BASE_URL      = process.env.DESK_BASE_URL || "https://desk.zoho.com/api/v1";

// ---- CATEGORY / SUBCATEGORY REFERENCE LIST --------------------------

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

// ---- PROMPT BUILDER (forces allowed categories + follow-up values) ---

function PROMPT(payload) {
  const {
    subject = "N/A",
    status = "N/A",
    priority = "N/A",
    channel = "N/A",
    department = "N/A",
    conversation = ""
  } = payload || {};

  return `
You are an AI Ticket Audit Assistant. Analyze this Zoho Desk ticket for 360° agent performance using ONLY the provided data.

Your tasks:

1. FOLLOW-UP AUDIT
Decide if the agent promised or needed a follow-up and whether it was completed.
Classify into EXACTLY ONE of these values (no other text):
- "Follow-up Completed"
- "Delayed Follow-up"
- "Missed Follow-up"
- "No Follow-up Required"

Return this as: "follow_up_status": "<one of the four above>"

2. CATEGORY & SUBCATEGORY (STRICT)
Use ONLY the Category → Subcategory reference list below.
- Category MUST be exactly one of the "Category: ..." names.
- Subcategory MUST be exactly one of the bullet points under that Category.
Do NOT invent new names.

Return:
"category": "<Category from list>",
"subcategory": "<Subcategory from list>"

REFERENCE LIST:
${REFERENCE_LIST}

3. SCORING (0–10 integer each)
Score the ticket on:
- follow_up_frequency (0–10)
- no_drops (0–10)
- sla_adherence (0–10)
- resolution_quality (0–10)
- customer_sentiment (0–10)
- agent_tone (0–10)

4. REASONS PER SCORE
For EACH score above, provide a 1–2 sentence explanation:
- score_reasons.follow_up_frequency
- score_reasons.no_drops
- score_reasons.sla_adherence
- score_reasons.resolution_quality
- score_reasons.customer_sentiment
- score_reasons.agent_tone

5. FINAL AI TICKET SCORE (0–10)
Compute an overall final_score considering:
- Follow-Up 15%
- No Drops 15%
- SLA 20%
- Resolution Quality 20%
- Customer Sentiment 15%
- Agent Tone 15%

Also provide a short overall explanation summarizing why the final_score and follow_up_status were chosen.

Return a SINGLE JSON object ONLY, no markdown, matching this shape:

{
  "title": "Ticket Follow-up Analysis",
  "follow_up_status": "Follow-up Completed | Delayed Follow-up | Missed Follow-up | No Follow-up Required",
  "category": "string (from reference list)",
  "subcategory": "string (from reference list)",
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
  "reasons": "one brief paragraph"
}

Ticket context:
Subject: ${subject}
Status: ${status}
Priority: ${priority}
Channel: ${channel}
Department: ${department}

Full conversation + notes:
${conversation}
`;
}

// ---- HELPERS --------------------------------------------------------

// Normalize AI follow_up_status to your 4 picklist values
function normalizeFollowUpStatus(aiStatus) {
  if (!aiStatus) return "No Commitment Found";

  const s = String(aiStatus).toLowerCase();

  if (s.includes("follow-up completed") || s.includes("follow up completed") || s.includes("completed")) {
    return "Follow-up Completed";
  }
  if (s.includes("delayed")) {
    return "Delayed Follow-up";
  }
  if (s.includes("missed")) {
    return "Missed Follow-up";
  }
  if (s.includes("no follow-up required") ||
      s.includes("no follow up required") ||
      s.includes("no follow-up needed") ||
      s.includes("no follow up needed") ||
      s.includes("no commitment")) {
    return "No Follow-up Required";
  }
  // Safe default when unsure
  return "No Commitment Found";
}

// OpenAI call using json_object response
async function callOpenAI(payload) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY env var");
  }

  const prompt = PROMPT(payload);

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Only output valid JSON that matches the requested schema." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    })
  });

  const data = await r.json();
  if (!r.ok) {
    console.error("OpenAI error:", data);
    throw new Error(`OpenAI error ${r.status}`);
  }

  const content = data.choices?.[0]?.message?.content || "{}";
  console.log("Raw OpenAI JSON:", content.slice(0, 1000));
  return JSON.parse(content);
}

// Map AI result → Zoho Desk custom fields & PATCH ticket
async function updateZohoDeskTicket(ticketId, ai) {
  if (!DESK_ORG_ID || !DESK_OAUTH_TOKEN) {
    throw new Error("Missing DESK_ORG_ID or DESK_OAUTH_TOKEN env vars");
  }

  const scores  = ai.scores        || {};
  const reasons = ai.score_reasons || {};

  const followUpStatus = normalizeFollowUpStatus(ai.follow_up_status);

  // NOTE: keys below are DISPLAY NAMES of your custom fields
  const customFields = {
    // classification
    "AI Category": ai.category || "",
    "AI Sub Category": ai.subcategory || "",
    "AI Category explanation": ai.reasons || "",
    "AI Final Score": ai.final_score ?? null,

    // follow-up status picklist
    "Follow-up Status": followUpStatus,

    // numeric scores
    "Follow-Up Frequency": scores.follow_up_frequency ?? null,
    "No Drops Score":      scores.no_drops ?? null,
    "SLA Adherence":       scores.sla_adherence ?? null,
    "Resolution Quality":  scores.resolution_quality ?? null,
    "Customer Sentiment":  scores.customer_sentiment ?? null,
    "Agent Tone":          scores.agent_tone ?? null,

    // textual reasons
    "Reason Follow-Up Frequency": reasons.follow_up_frequency || "",
    "Reason No Drops":            reasons.no_drops || "",
    "Reasons SLA Adherence":      reasons.sla_adherence || "",
    "Reason Resolution Quality":  reasons.resolution_quality || "",
    "Reason Customer Sentiment":  reasons.customer_sentiment || "",
    "Reason Agent Tone":          reasons.agent_tone || "",
  };

  // Drop undefined
  Object.keys(customFields).forEach((k) => {
    if (customFields[k] === undefined) delete customFields[k];
  });

  const body = { customFields };

  const url = `${DESK_BASE_URL}/tickets/${ticketId}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      orgId: DESK_ORG_ID,
      Authorization: `Zoho-oauthtoken ${DESK_OAUTH_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  return { status: resp.status, data };
}

// ---- ROUTES ---------------------------------------------------------

// health check
app.get("/", (_req, res) => res.send("✅ Railway app is live!"));

// main Desk webhook
app.post("/desk-webhook", async (req, res) => {
  try {
    const headerSecret =
      req.headers["desk-shared-secret"] ||
      req.headers["desk_shared_secret"];

    if (!DESK_SHARED_SECRET) {
      console.error("DESK_SHARED_SECRET not configured");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    if (!headerSecret || headerSecret !== DESK_SHARED_SECRET) {
      console.warn("Unauthorized webhook hit, bad secret:", headerSecret);
      return res.status(403).json({ error: "Unauthorized" });
    }

    const payload = req.body || {};
    const ticketId = payload.ticket_id;

    if (!ticketId) {
      return res.status(400).json({ error: "ticket_id missing in payload" });
    }

    console.log(
      "Webhook hit for ticket:",
      ticketId,
      "subject:",
      (payload.subject || "").slice(0, 100)
    );

    // 1) Call OpenAI with your strict prompt
    const ai = await callOpenAI(payload);
    console.log("AI result:", JSON.stringify(ai).slice(0, 1500));

    // 2) Update Zoho Desk ticket with scores + reasons + category/subcategory
    let deskResult;
    try {
      deskResult = await updateZohoDeskTicket(ticketId, ai);
      console.log(
        "Desk update response:",
        JSON.stringify(deskResult).slice(0, 1500)
      );
    } catch (deskErr) {
      console.error("Zoho Desk update failed:", deskErr);
      deskResult = { status: 500, data: { error: String(deskErr) } };
    }

    // 3) Respond back so Deluge can log
    return res.json({
      ok: true,
      ai,
      desk: deskResult,
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- START SERVER ---------------------------------------------------

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on port", PORT));
