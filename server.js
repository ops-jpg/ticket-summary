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

// ================== BUSINESS HOURS CONFIG (CST) ==================
const BUSINESS_TZ_OFFSET_HOURS = -6;          // CST offset from UTC
const BUSINESS_START_HOUR      = 8;           // 08:00
const BUSINESS_END_HOUR        = 18;          // 18:00
const BUSINESS_DAYS            = [1, 2, 3, 4, 5]; // Mon–Fri

// Helper: compute business minutes between two ISO datetimes
function businessMinutesBetween(startISO, endISO) {
  if (!startISO || !endISO) return 0;

  const start = new Date(startISO);
  const end   = new Date(endISO);
  if (isNaN(start) || isNaN(end) || end <= start) return 0;

  const offsetMs = BUSINESS_TZ_OFFSET_HOURS * 60 * 60 * 1000;
  let totalMs = 0;

  let currentMs = start.getTime();
  const endMs   = end.getTime();

  while (currentMs < endMs) {
    // Shift to "business local" (CST) timeline by adding offset
    const currentLocal = new Date(currentMs + offsetMs);

    const day = currentLocal.getUTCDay(); // 0–6, but now in CST day
    if (BUSINESS_DAYS.includes(day)) {
      const y = currentLocal.getUTCFullYear();
      const m = currentLocal.getUTCMonth();
      const d = currentLocal.getUTCDate();

      // 08:00 and 18:00 in CST, expressed on our "local" timeline
      const dayStartLocal = Date.UTC(y, m, d, BUSINESS_START_HOUR, 0, 0);
      const dayEndLocal   = Date.UTC(y, m, d, BUSINESS_END_HOUR, 0, 0);

      // Convert business window back to real UTC ms
      const dayStartUtcMs = dayStartLocal - offsetMs;
      const dayEndUtcMs   = dayEndLocal   - offsetMs;

      const sliceStart = Math.max(currentMs, dayStartUtcMs);
      const sliceEnd   = Math.min(endMs,   dayEndUtcMs);

      if (sliceEnd > sliceStart) {
        totalMs += (sliceEnd - sliceStart);
      }
    }

    // Jump to next local midnight on the "business" (CST) timeline
    const nextLocalMidnight = new Date(
      Date.UTC(
        currentLocal.getUTCFullYear(),
        currentLocal.getUTCMonth(),
        currentLocal.getUTCDate() + 1,
        0, 0, 0
      )
    );
    const nextUtcMs = nextLocalMidnight.getTime() - offsetMs;

    // Ensure forward progress
    currentMs = Math.max(currentMs + 1, nextUtcMs);
  }

  return Math.round(totalMs / 60000); // minutes
}

function businessHoursBetween(startISO, endISO) {
  return businessMinutesBetween(startISO, endISO) / 60;
}

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

// ---- PROMPT (includes time per user & time per role) ----
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

6. TIME SPENT PER USER (MULTILINE TEXT):
Using the Owner Change Log, estimate time spent *per individual user/agent*.
Return a multiline string like:
"Mannat - 3 hrs
Shikha - 2 hrs"
Use whole hours or half-hours (e.g. 1.5 hrs) as approximate values.
Return this as: "time_spent_per_user": "<multiline string>"

7. TIME SPENT PER ROLE (MULTILINE TEXT):
Using the Owner Change Log, estimate time spent *per role/team*.
Return a multiline string like:
"Escalation Manager - 1 hr
Adit Pay - 2 hrs"
(Use the role/team names as they appear or can be reasonably inferred.)
Return this as: "time_spent_per_role": "<multiline string>"

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
  "owner_time_summary": "one short sentence about which team/owner had the ticket longest",
  "time_spent_per_user": "Mannat - 3 hrs\\nShikha - 2 hrs",
  "time_spent_per_role": "Escalation Manager - 1 hr\\nAdit Pay - 2 hrs"
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
  if (s.includes("delayed"))   return "Delayed Follow-up";
  if (s.includes("missed"))    return "Missed Follow-up";
  if (s.includes("no follow-up required") || s.includes("no commitment"))
    return "No Follow-up Required";

  // fallback
  return "No Commitment Found";
}

// ---- Fetch ticket from Zoho Desk (for SLA dates) ----
async function fetchDeskTicket(ticketId) {
  if (!ZOHO_OAUTH_TOKEN || !ZOHO_ORG_ID) return null;

  const r = await fetch(`https://desk.zoho.com/api/v1/tickets/${ticketId}`, {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${ZOHO_OAUTH_TOKEN}`,
      orgId: ZOHO_ORG_ID,
    },
  });

  if (!r.ok) {
    console.warn("Failed to fetch ticket for SLA calc:", r.status);
    return null;
  }

  const data = await r.json().catch(() => null);
  return data || null;
}

// ---- Update Zoho Desk ticket ----
async function updateDeskTicket(ticketId, aiResult, ownerChangeLog) {
  if (!ZOHO_OAUTH_TOKEN || !ZOHO_ORG_ID) {
    console.warn("ZOHO_OAUTH_TOKEN or ZOHO_ORG_ID missing; skipping Desk update.");
    return { skipped: true };
  }

  // Pull out AI structures, but we'll override SLA with our own rule.
  const scores       = aiResult.scores || {};
  const scoreReasons = aiResult.score_reasons || {};
  const followUpStatus = normalizeFollowUpStatus(aiResult.follow_up_status);

  const ownerTimeRemark = aiResult.owner_time_summary || ""; // -> Remarks-OC Log
  const aiMainSummary   = aiResult.reasons || "";            // main AI paragraph

  const timeSpentPerUser = aiResult.time_spent_per_user || "";
  const timeSpentPerRole = aiResult.time_spent_per_role || "";

  // ---- SLA ADHERENCE BASED ON BUSINESS HOURS RULE ----
  let slaScore  = scores.sla_adherence ?? null;
  let slaReason = scoreReasons.sla_adherence || "";

  try {
    const ticket = await fetchDeskTicket(ticketId);
    if (ticket) {
      const createdTime =
        ticket.createdTime ||
        (ticket.customFields && ticket.customFields["Created Time1"]) ||
        null;

      const cf          = ticket.cf || {};
      const custom      = ticket.customFields || {};

      const firstResponseTime =
        cf.cf_first_response_time ||
        custom["First Response Time"] ||
        null;

      const closedTime =
        ticket.closedTime ||
        cf.cf_closed_time ||
        custom["Closed Time"] ||
        null;

      if (createdTime && firstResponseTime && closedTime) {
        const frMinutes = businessMinutesBetween(createdTime, firstResponseTime);
        const resHours  = businessHoursBetween(createdTime, closedTime);

        const firstWithin30 = frMinutes <= 30;
        const resWithin4    = resHours  <= 4;

        const withinSLA = firstWithin30 && resWithin4;

        // Binary scoring rule: full score if both under SLA, else low score
        slaScore = withinSLA ? 10 : 3;

        const frPretty  = Math.round(frMinutes);
        const resPretty = resHours.toFixed(1);

        if (withinSLA) {
          slaReason =
            `First response in about ${frPretty} business minutes and ` +
            `resolution in about ${resPretty} business hours; both within SLA ` +
            `(30 minutes for first response, 4 hours for resolution).`;
        } else {
          slaReason =
            `SLA breached: first response took about ${frPretty} business minutes ` +
            `and resolution about ${resPretty} business hours, exceeding the ` +
            `30-minute / 4-hour SLA targets.`;
        }

        // Override AI values so mappings below pick up these numbers
        scores.sla_adherence          = slaScore;
        scoreReasons.sla_adherence    = slaReason;
      }
    }
  } catch (e) {
    console.error("Error computing SLA adherence:", e);
  }

  // Brief AI Summary uses the generic explanation only
  const briefSummary = aiMainSummary;

  // ---- CUSTOM FIELDS BY LABEL ----
  const customFields = {
    // MAIN AI LABELS
    "Follow-up Status": followUpStatus,
    "AI Category": aiResult.category || "",
    "AI Sub Category": aiResult.subcategory || "",
    "AI Final Score": aiResult.final_score ?? null,
    "AI Category explanation": briefSummary,

    // NUMERIC SCORES
    "Follow-Up Frequency": scores.follow_up_frequency ?? null,
    "No Drops Score":      scores.no_drops            ?? null,
    "SLA Adherence":       scores.sla_adherence       ?? null,
    "Resolution Quality":  scores.resolution_quality  ?? null,
    "Customer Sentiment":  scores.customer_sentiment  ?? null,
    "Agent Tone":          scores.agent_tone          ?? null,

    // PER-SCORE REASONS
    "Reason Follow-Up Frequency": scoreReasons.follow_up_frequency || "",
    "Reason No Drops":            scoreReasons.no_drops            || "",
    "Reasons SLA Adherence":      scoreReasons.sla_adherence       || "",
    "Reason Resolution Quality":  scoreReasons.resolution_quality  || "",
    "Reason Customer Sentiment":  scoreReasons.customer_sentiment  || "",
    "Reason Agent Tone":          scoreReasons.agent_tone          || "",

    // Owner time remark
    "Remarks-OC Log": ownerTimeRemark,

    // Human-readable multiline fields (labels)
    "Time Spent Per User": timeSpentPerUser,
    "Time Spent Per Role": timeSpentPerRole,
  };

  // ---- API-NAME FIELDS ----
  const body = {
    customFields,
    cf: {
      // Brief AI Summary – API name
      cf_ai_category_explanation: briefSummary,

      // Remarks-OC Log – API name
      cf_remarks_oc_log: ownerTimeRemark,

      // Legacy / existing mapping if used elsewhere
      cf_ts_resolution: ownerTimeRemark,

      // Multiline breakdowns – make sure these match your Desk API names
      cf_csm_resolution:  timeSpentPerUser,
      cf_voip_resolution: timeSpentPerRole,
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
