// server.js
import express from "express";
import crypto from "crypto";

// Node 18+ has global fetch.
// If you are on an older Node, install node-fetch and uncomment:
// import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ------------ ENV VARS ------------
const DESK_SHARED_SECRET = process.env.DESK_SHARED_SECRET;
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY;
const ZOHO_ORG_ID        = process.env.ZOHO_ORG_ID;
const ZOHO_OAUTH_TOKEN   = process.env.ZOHO_OAUTH_TOKEN;

// ------------ CATEGORY / SUBCATEGORY / ISSUE SUMMARY LIST ------------
// Format: for EACH row from your spreadsheet:
// Category: <Category>
// - <Subcategory>: <Issue Summary>
//
// Below are some examples from your xlsx. Continue this pattern
// until ALL rows from the sheet are covered.

const REFERENCE_LIST = `
Category: OS Issue
- Mapping: Appointment mapping not synced correctly with EHR.
- Configuration: Configuration mismatch between ADIT and EHR.
- Appointment Write problem into EHR: Appointment write-back to EHR is failing.
- Wrong Appointment Time: Appointments show wrong time between ADIT and EHR.
- Slot Missing: Appointment slots missing compared to EHR.
- Slot Available on Block / Holiday: Blocked/holiday slots still appear available.
- Provider Hours missing: Provider hours not created on schedule.
- Operatory Hours Missing: Operatory open hours not matching EHR schedule.
- Business hours Missing: Business hours mismatch between EHR and ADIT.
- Incorrect Slots appear: Slots not blocked correctly on EHR.
- Forms configuration issue: Webforms not configured properly for online scheduling.

Category: Engage Issue
- Appointment Reminder isn't received: Patients not receiving appointment reminders.
- Appointment Reminder Setup Issue: Appointment reminders not configured correctly.
- Appointment Reminder with incorrect time: Appointment reminders going at wrong time or due to reschedule.
- Appointment Reminder with delay: Appointment reminders not sent at correct time.
- Appointment Reminder (Filters / SC not toggled): SC not toggled or advanced filters blocking reminders.
- Schedule Confirmation Setup Issue: Schedule confirmation not configured correctly.
- Patient Forms missing on SC: Patient forms were not added on SC.
- Appointment reminder CRON issue: Reminder CRON service issue; reminders not sending.
- Schedule confirmation CRON issue: Schedule confirmation CRON not working.

Category: Desktop Phones
- Phone not ringing when receiving calls: Desktop phone does not ring on inbound calls.
- Unable to make outbound calls: Desktop phone cannot place outbound calls.
- Account not registered / logged out: SIP account not registered or phone logged out.
- Keys not responding or malfunctioning: Phone keys or buttons not working correctly.
- Phone not powering on / random shutdowns: Device not powering on or keeps shutting down.
- Call park not working: Call park feature not functioning on desktop phone.
- Firmware not updating or stuck update: Phone firmware update fails or is stuck.
- Receiver not working / no audio: No audio in handset/receiver.
- Faulty handset or LAN ports: Hardware issue with handset or LAN ports.
- LAN cable damaged / loose: LAN cable issue causing connectivity problems.
- Bluetooth headset not connecting: Bluetooth headset pairing/connection issues.

Category: Cordless Phones
- Phone not ringing when receiving calls: Cordless device not ringing on inbound calls.
- Unable to make outbound calls: Cordless device cannot place outbound calls.
- Account not registered / logged out: SIP account not registered or handset logged out.
- Phone goes out of range: Cordless phone losing connection due to range.
- Base station offline or disconnected: Base station not reachable or not powered.
- Keys not responding or malfunctioning: Handset keys not working.
- Phone not powering on / random shutdowns: Cordless phone not turning on / random reboots.
- Call park not working: Call park not functioning on cordless device.
- Firmware not updating or stuck update: Firmware update stuck on cordless phone.
- Receiver not working / no audio: No audio on cordless receiver.
- Faulty handset or LAN ports: Hardware defect on base station ports.
- LAN cable damaged / loose: LAN issues for base station.
- Bluetooth headset not connecting: Bluetooth pairing issues on cordless system.

/* ✳️ CONTINUE for ALL remaining categories, subcategories and issue summaries
   directly from the spreadsheet, following the same pattern:

Category: <Category Name>
- <Subcategory 1>: <Issue summary text>
- <Subcategory 2>: <Issue summary text>
...
*/
`;

// ------------ PROMPT (includes time per user & role + issue_summary) ------------
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

2. CATEGORY, SUBCATEGORY & ISSUE SUMMARY (STRICT):
Use ONLY the Category → Subcategory → Issue Summary reference list below.
Do not invent new names. Pick the closest best match.
Return:
  "category": "<Category>",
  "subcategory": "<Subcategory>",
  "issue_summary": "<Issue Summary text for that exact category/subcategory>"

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
Return: "owner_time_summary": "<short remark>"

6. TIME SPENT PER USER (MULTILINE TEXT):
Using the Owner Change Log, estimate time spent per individual user/agent.
Return a multiline string like:
"Mannat - 3 hrs
Shikha - 2 hrs"
Use whole hours or half-hours (e.g. 1.5 hrs) as approximate values.
Return: "time_spent_per_user": "<multiline string>"

7. TIME SPENT PER ROLE (MULTILINE TEXT):
Using the Owner Change Log, estimate time spent per role/team.
Return a multiline string like:
"Escalation Manager - 1 hr
Adit Pay - 2 hrs"
Return: "time_spent_per_role": "<multiline string>"

Return a single JSON object only, with keys:
{
  "title": "Ticket Follow-up Analysis",
  "follow_up_status": "...",
  "category": "...",
  "subcategory": "...",
  "issue_summary": "...",
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

// ------------ OpenAI caller ------------
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

// ------------ Map AI follow-up to Zoho picklist ------------
function normalizeFollowUpStatus(raw) {
  if (!raw) return null;
  const s = raw.toString().toLowerCase();

  if (s.includes("completed")) return "Follow-up Completed";
  if (s.includes("delayed"))   return "Delayed Follow-up";
  if (s.includes("missed"))    return "Missed Follow-up";
  if (s.includes("no follow-up required") || s.includes("no commitment"))
    return "No Follow-up Required";

  return "No Commitment Found";
}

// ------------ Update Zoho Desk ticket ------------
async function updateDeskTicket(ticketId, aiResult) {
  if (!ZOHO_OAUTH_TOKEN || !ZOHO_ORG_ID) {
    console.warn("ZOHO_OAUTH_TOKEN or ZOHO_ORG_ID missing; skipping Desk update.");
    return { skipped: true };
  }

  const scores         = aiResult.scores || {};
  const scoreReasons   = aiResult.score_reasons || {};
  const followUpStatus = normalizeFollowUpStatus(aiResult.follow_up_status);

  const ownerTimeRemark = aiResult.owner_time_summary || "";
  const aiMainSummary   = aiResult.reasons || "";
  const timeSpentPerUser = aiResult.time_spent_per_user || "";
  const timeSpentPerRole = aiResult.time_spent_per_role || "";
  const issueSummary     = aiResult.issue_summary || "";

  const briefSummary = aiMainSummary;

  // ---- custom fields by LABEL (Zoho Desk UI labels) ----
  const customFields = {
    "Follow-up Status": followUpStatus,
    "AI Category": aiResult.category || "",
    "AI Sub Category": aiResult.subcategory || "",
    "AI Final Score": aiResult.final_score ?? null,
    "AI Category explanation": briefSummary, // "Brief AI Summary"

    "Follow-Up Frequency": scores.follow_up_frequency ?? null,
    "No Drops Score":       scores.no_drops ?? null,
    "SLA Adherence":        scores.sla_adherence ?? null,
    "Resolution Quality":   scores.resolution_quality ?? null,
    "Customer Sentiment":   scores.customer_sentiment ?? null,
    "Agent Tone":           scores.agent_tone ?? null,

    "Reason Follow-Up Frequency":  scoreReasons.follow_up_frequency || "",
    "Reason No Drops":             scoreReasons.no_drops || "",
    "Reasons SLA Adherence":       scoreReasons.sla_adherence || "",
    "Reason Resolution Quality":   scoreReasons.resolution_quality || "",
    "Reason Customer Sentiment":   scoreReasons.customer_sentiment || "",
    "Reason Agent Tone":           scoreReasons.agent_tone || "",

    "Remarks-OC Log": ownerTimeRemark,

    // NEW labels in Desk (create as Multi-line fields)
    "Time Spent Per User": timeSpentPerUser,
    "Time Spent Per Role": timeSpentPerRole,
    "Issue Summary":       issueSummary,
  };

  // ---- custom fields by API NAME ----
  const body = {
    customFields,
    cf: {
      // Brief AI Summary
      cf_ai_category_explanation: briefSummary,

      // Remarks-OC Log
      cf_remarks_oc_log: ownerTimeRemark,

      // If you still use this older field for remarks:
      cf_ts_resolution: ownerTimeRemark,

      // Time spent fields (adjust to your real API names)
      cf_csm_resolution: timeSpentPerUser,
      cf_voip_resolution: timeSpentPerRole,

      // Issue summary field (set its API name here)
      cf_tech_csm_resolution: issueSummary,
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

// ------------ Health check ------------
app.get("/", (_req, res) => {
  res.send("✅ Railway app is live!");
});

// ------------ Webhook ------------
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
      deskResult = await updateDeskTicket(ticket_id, ai);
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

// ------------ Start server ------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
