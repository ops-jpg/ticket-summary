import express from "express";

// Node 18+ has global fetch. If you're on older Node, install node-fetch and import it:
// import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ------------ ENV VARS ------------
const DESK_SHARED_SECRET   = process.env.DESK_SHARED_SECRET;
const OPENAI_API_KEY       = process.env.OPENAI_API_KEY;
const ZOHO_DESK_ORG_ID     = process.env.ZOHO_DESK_ORG_ID;
const ZOHO_DESK_OAUTH      = process.env.ZOHO_DESK_OAUTH_TOKEN;
const ZOHO_DESK_BASE_URL   = process.env.ZOHO_DESK_BASE_URL || "https://desk.zoho.com/api/v1";

if (!DESK_SHARED_SECRET) console.warn("⚠️ DESK_SHARED_SECRET not set");
if (!OPENAI_API_KEY)     console.warn("⚠️ OPENAI_API_KEY not set");
if (!ZOHO_DESK_ORG_ID)   console.warn("⚠️ ZOHO_DESK_ORG_ID not set");
if (!ZOHO_DESK_OAUTH)    console.warn("⚠️ ZOHO_DESK_OAUTH_TOKEN not set");

// ------------ REFERENCE LIST (from you) ------------
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

// ------------ PROMPT BUILDER ------------
const PROMPT = ({ subject, status, priority, channel, department, conversation }) => `
You are an AI Ticket Audit Assistant. Analyze this Zoho Desk ticket for 360° agent performance using ONLY the provided data.
Evaluate follow-ups, tone, and resolution quality.

1. FOLLOW-UP AUDIT:
Check if the agent promised any callback/follow-up and whether it was completed.
Classify as exactly one of:
- Follow-up Completed
- Delayed Follow-up
- Missed Follow-up
- No Commitment Found
Return in JSON as: "follow_up_status": "<one of the four above>"

2. CATEGORY & SUBCATEGORY (STRICT):
Use ONLY the Category → Subcategory reference list below.
Do NOT invent names; pick the closest best match from the list.
Return: "category": "<Category>", "subcategory": "<Subcategory>"

REFERENCE LIST:
${REFERENCE_LIST}

3. SCORING (0–10 each, integers):
- Follow-Up Frequency
- No Drops
- SLA Adherence
- Resolution Quality
- Customer Sentiment (0–10)
- Agent Tone (0–10)

Also provide a SHORT reason for each score in a "score_reasons" object.

4. FINAL AI TICKET SCORE (0–10 weighted):
- Follow-Up 15%
- No Drops 15%
- SLA 20%
- Resolution 20%
- Sentiment 15%
- Tone 15%

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
  "reasons": "one brief paragraph explaining overall assessment"
}

Ticket:
Subject: ${subject}
Status: ${status}
Priority: ${priority}
Channel: ${channel}
Department: ${department}
Conversation:
${conversation}
`;

// ------------ OPENAI CALL ------------
async function callOpenAI(prompt) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: "Only output valid JSON that matches the requested schema." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`OpenAI error ${r.status}: ${text}`);
  }

  const data = await r.json();
  return JSON.parse(data.choices[0].message.content);
}

// ------------ FOLLOW-UP STATUS NORMALISATION ------------
function normalizeFollowUpStatus(raw) {
  if (!raw) return "No Commitment Found";
  const t = raw.toString().toLowerCase().trim();

  const map = {
    "follow-up completed": "Follow-up Completed",
    "follow up completed": "Follow-up Completed",
    "completed": "Follow-up Completed",

    "delayed follow-up": "Delayed Follow-up",
    "delayed follow up": "Delayed Follow-up",
    "delayed": "Delayed Follow-up",

    "missed follow-up": "Missed Follow-up",
    "missed follow up": "Missed Follow-up",
    "missed": "Missed Follow-up",

    "no commitment found": "No Commitment Found",
    "no follow-up required": "No Commitment Found",
    "no follow up required": "No Commitment Found",
    "none": "No Commitment Found"
  };

  for (const [k, v] of Object.entries(map)) {
    if (t === k || t.includes(k)) return v;
  }
  return "No Commitment Found";
}

// ------------ OWNER CHANGE LOG PARSING ------------
function safeDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// line format example:
// "Owner changed to Chloe Finn (Tech OB) on 2025-11-18 21:30:23"
function parseOwnerChangeLog(logText, createdIso, closedIso) {
  if (!logText || typeof logText !== "string") return { segments: [] };

  const created = safeDate(createdIso);
  const closed = safeDate(closedIso);

  const lines = logText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const entries = [];

  const re = /Owner changed to (.+?)(?: \((.+?)\))? on (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/i;

  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const owner = m[1].trim();
    const role = (m[2] || "Unknown").trim();
    const when = safeDate(m[3].replace(" ", "T") + "Z"); // treat as UTC
    if (!when) continue;
    entries.push({ owner, role, when });
  }

  if (entries.length === 0) return { segments: [] };

  entries.sort((a, b) => a.when - b.when);

  const segments = [];
  for (let i = 0; i < entries.length; i++) {
    const cur = entries[i];
    const next = entries[i + 1];
    const from = cur.when;
    let to;

    if (next) {
      to = next.when;
    } else if (closed) {
      to = closed;
    } else {
      to = new Date(); // fallback
    }

    const hours = Math.max(0, (to - from) / 3_600_000);
    segments.push({
      owner: cur.owner,
      role: cur.role,
      from: from.toISOString(),
      to: to.toISOString(),
      hours
    });
  }

  if (created && created < new Date(segments[0].from)) {
    const first = segments[0];
    const extraHours = Math.max(0, (new Date(first.from) - created) / 3_600_000);
    first.from = created.toISOString();
    first.hours += extraHours;
  }

  return { segments };
}

function summarizeOwnerTime(parsed) {
  const segments = parsed.segments || [];
  const byUser = {};
  const byRole = {};
  let totalHours = 0;

  for (const seg of segments) {
    const h = seg.hours || 0;
    totalHours += h;

    if (seg.owner) {
      byUser[seg.owner] = (byUser[seg.owner] || 0) + h;
    }
    const role = seg.role || "Unknown";
    byRole[role] = (byRole[role] || 0) + h;
  }

  return { segments, byUser, byRole, totalHours };
}

function buildOwnerTimeRemark(ownerTime) {
  if (!ownerTime || !ownerTime.byRole || Object.keys(ownerTime.byRole).length === 0) {
    return "Owner time could not be determined from the Owner Change Log.";
  }

  let topRole = null;
  let topHours = 0;
  let total = 0;

  for (const [role, hrs] of Object.entries(ownerTime.byRole)) {
    total += hrs;
    if (hrs > topHours) {
      topHours = hrs;
      topRole = role;
    }
  }

  if (!topRole || total === 0) {
    return "Owner time could not be determined from the Owner Change Log.";
  }

  const pct = Math.round((topHours / total) * 100);
  return `Most of this ticket's time (${topHours.toFixed(1)} hours, ${pct}% of total) was spent with the ${topRole} team. Please refer to the Owner Change Log for full history.`;
}

// ------------ ZOHO DESK UPDATE ------------
async function updateZohoDeskTicket({ ticketId, aiResult, ownerTimeRemark }) {
  if (!ZOHO_DESK_OAUTH || !ZOHO_DESK_ORG_ID) {
    console.warn("⚠️ Zoho Desk env vars not set, skipping update");
    return { skipped: true };
  }
  if (!ticketId) {
    console.warn("⚠️ No ticketId provided for Desk update");
    return { skipped: true };
  }

  const scores = aiResult.scores || {};
  const scoreReasons = aiResult.score_reasons || {};

  const followUpStatus = normalizeFollowUpStatus(aiResult.follow_up_status);

  // These keys are *field labels* in your Zoho layout.
  const customFields = {
    // main AI labels
    "Follow-up Status": followUpStatus,
    "AI Category": aiResult.category || "",
    "AI Sub Category": aiResult.subcategory || "",
    "AI Final Score": aiResult.final_score ?? null,
    "AI Category explanation": aiResult.reasons || "",

    // numeric scores
    "Follow-Up Frequency": scores.follow_up_frequency ?? null,
    "No Drops Score": scores.no_drops ?? null,
    "SLA Adherence": scores.sla_adherence ?? null,
    "Resolution Quality": scores.resolution_quality ?? null,
    "Customer Sentiment": scores.customer_sentiment ?? null,
    "Agent Tone": scores.agent_tone ?? null,

    // per-score reasons
    "Reason Follow-Up Frequency": scoreReasons.follow_up_frequency || "",
    "Reason No Drops": scoreReasons.no_drops || "",
    "Reasons SLA Adherence": scoreReasons.sla_adherence || "",
    "Reason Resolution Quality": scoreReasons.resolution_quality || "",
    "Reason Customer Sentiment": scoreReasons.customer_sentiment || "",
    "Reason Agent Tone": scoreReasons.agent_tone || "",

    // 👇 Owner time remark → your multiline "TS Resolution" (API name cf_ts_resolution)
     "Remarks-OC Log": ownerTimeRemark || ""
  };

  const body = { customFields };

  const url = `${ZOHO_DESK_BASE_URL}/tickets/${ticketId}`;

  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Zoho-oauthtoken ${ZOHO_DESK_OAUTH}`,
      "orgId": ZOHO_DESK_ORG_ID,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    console.error("❌ Zoho Desk update failed", resp.status, data);
    throw new Error(`Zoho Desk update error ${resp.status}`);
  }

  console.log("✅ Zoho Desk update response:", JSON.stringify(data).slice(0, 2000));
  return data;
}

// ------------ HEALTH CHECK ------------
app.get("/", (_req, res) => {
  res.send("✅ Railway app is live!");
});

// ------------ MAIN WEBHOOK ------------
app.post("/desk-webhook", async (req, res) => {
  try {
    const secret = req.headers["desk-shared-secret"];
    if (!secret || secret !== DESK_SHARED_SECRET) {
      console.warn("❌ Unauthorized webhook hit");
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
      ticket_created_time = null,
      ticket_closed_time = null
    } = body;

    console.log("🎯 Webhook for ticket:", ticket_id, "| Subject:", subject);

    const prompt = PROMPT({ subject, status, priority, channel, department, conversation });
    const ai = await callOpenAI(prompt);
    console.log("🤖 AI result:", JSON.stringify(ai).slice(0, 2000));

    const parsedOwner = parseOwnerChangeLog(owner_change_log, ticket_created_time, ticket_closed_time);
    const ownerTime = summarizeOwnerTime(parsedOwner);
    console.log("⏱ Owner time summary:", ownerTime);
    const ownerRemark = buildOwnerTimeRemark(ownerTime);
    console.log("📝 Owner remark:", ownerRemark);

    let deskUpdate = null;
    try {
      deskUpdate = await updateZohoDeskTicket({
        ticketId: ticket_id,
        aiResult: ai,
        ownerTimeRemark: ownerRemark
      });
    } catch (e) {
      console.error("Zoho Desk update error (non-fatal for webhook):", e.message);
    }

    return res.json({
      ok: true,
      ai,
      owner_time: ownerTime,
      owner_remark: ownerRemark,
      desk_update: deskUpdate
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------ START SERVER ------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
