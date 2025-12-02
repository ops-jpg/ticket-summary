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
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;
const ZOHO_OAUTH_TOKEN = process.env.ZOHO_OAUTH_TOKEN;

// ------------ BUSINESS HOURS (CST / Central Standard Time) ------------
// From your screenshot: Mon-Fri 08:00 AM - 06:00 PM CST. Closed Sat/Sun.
const BUSINESS_TZ = "America/Chicago";
const BUSINESS_DAYS = [1, 2, 3, 4, 5]; // Mon..Fri (JS getDay(): Sun=0)
const BUSINESS_START_MIN = 8 * 60; // 08:00
const BUSINESS_END_MIN = 18 * 60; // 18:00

// ------------ CATEGORY / SUBCATEGORY / ISSUE SUMMARY (COMPACT) ------------
const REFERENCE_LIST = `
OS Issue:
- Mapping: OS mapping mismatch vs EHR
- Configuration: OS setup/config needed
- Appointment Write problem into EHR: writeback off/fails
- Wrong Appointment Time: booked time wrong
- Slot Missing: slots missing vs EHR
- Slot Available on Block / Holiday: blocked/holiday slots visible
- Provider Hours Missing: provider hours missing
- Operatory Hours Missing: operatory hours wrong/missing
- Business Hours Missing: hours mismatch EHR vs Adit
- Incorrect Slots Appear: slots not blocked per EHR
- Forms Configuration Issue: OS webforms/microsite misconfig

Engage Issue:
- Appointment Reminder Isn't Received: AR not received
- Appointment Reminder Setup Issue: AR workflow/config missing
- Appointment Reminder With Incorrect Time: AR time wrong/out of sync
- Appointment Reminder Delay: AR late
- SC Isn't Received: SC not sent
- SC Issue for New & Existing Patient: SC flow wrong by patient type
- SC Issue With Patient Forms: SC missing forms
- AR Cron Issue: AR cron down
- SC Cron Issue: SC cron down
- BR Sent to Inactive Patients: BR to inactive
- BR Sent to Wrong Patient: BR wrong patient
- BR Not Sent: BR not triggered
- Recall Reminder Not Sent: recall not sent
- Recall Reminder to Inactive Patient: recall to inactive
- Recall Sent to Wrong Patient: recall wrong patient
- Recall Not Sent Despite Appointment: appt exists but no recall
- Recall Types Issue: recall types/toggles missing
- Recall Due Date Issue: recall due date wrong
- Payment Reminder Issue: payment reminders not sent
- Missed Call Text Issue: missed call text not sent (config/hours)
- Auto Confirmation Issue: auto-confirm not updating
- Appointment Write Issue: appt not written from OS
- Multiple Appointment Confirmed Issue: multi-confirm handling wrong
- Auto Confirm Thank You Issue: wrong thank-you
- Status Mapping Issue: status mapping wrong
- Auto Confirmation Mapping Issue: EHR not updating after confirm
- Auto Confirmation Reply Issue: auto-confirm reply not sent
- Chat Thread Not Updated: chat not syncing
- Wrong Chat Populate: wrong chat mapping/delay
- Chat Thread Missing: chat thread missing

Patient Form Issue:
- Patient Form Not Sending: not sent (bad email/phone)
- Patient Form Not Received: not received in Adit/EHR
- Form Details Not Auto-Populating: autofill missing
- Mapping Issue: PMS mapping wrong
- Allergies/Problem/Medication Not Syncing: APM not imported
- Allergies/Problem/Medication Write-back Issue: APM writeback fails
- Medical History Questions Not Syncing: MH questions not synced
- Medical History Write-back Issue: MH writeback fails
- Allergies/Problem/Medication Missing: APM missing
- Signature Issue: signature missing
- Multi-Sign Issue: multi-sign misconfig
- Patient Form Importing Issue: import sync fails
- Patient Form Missing After Submission: submitted form missing
- Device Connection Issue: kiosk/device disconnected/outdated
- Field Dependency Issue: conditional logic broken
- PDF Sync Issue: PDF not generated/synced
- PDF Not Opening in EHR: PDF not viewable in EHR
- Auto Import Issue: auto-import off/wrong link
- New Patient Updated Into Existing Patient: wrong chart link
- Existing Patient Updated With New Patient Details: overwrite wrong
- PDF Layout Issue: PDF formatting wrong
- Patient Form Auto Assign Issue: auto-assign/approve fails

Patient Card:
- Patient Details Missing: details missing
- Patient Logs Missing: logs missing
- Follow-Up Logs Missing: follow-up logs missing
- Wrong Last/Next/Due Date: dates wrong
- Image Missing: photo missing
- Patient Form Search Issue: form search fails

Pozative Issue:
- Review Request Not Sent: review request not sent
- Frequency Issue: review frequency wrong
- Business URL Missing: business/GMB URL missing
- Business Page Disconnection: GBP disconnected
- Feedback Issue: feedback missing
- Reviews Not Syncing: reviews not syncing

Email Issue:
- Email Bounce Back: DNS/TXT issue
- Email Sending Issue: email not sending
- Email Attachment Issue: attachment failures
- Email Tags Issue: tags not applied
- Email Reporting Issue: reporting wrong
- Unsubscribe Issue: unsubscribe fails

Desktop Phones:
- Phone not ringing when receiving calls: no ring
- Unable to make outbound calls: outbound fails
- Account not registered / logged out: SIP unregistered
- Keys not responding or malfunctioning: keys fail
- Phone not powering on / random shutdowns: power/reboot
- Call park not working: call park fails
- Firmware not updating or stuck update: fw update stuck
- Receiver not working / no audio: no audio
- Faulty handset or LAN ports: hardware/ports
- LAN cable damaged / loose: cable/connection
- Bluetooth headset not connecting: BT pairing

Cordless Phones:
- Phone not ringing when receiving calls: no ring
- Unable to make outbound calls: outbound fails
- Account not registered / logged out: SIP unregistered
- Phone goes out of range: range loss
- Base station offline or disconnected: base offline
- Keys not responding or malfunctioning: keys fail
- Phone not powering on / random shutdowns: power/battery
- Call park not working: call park fails
- Firmware not updating or stuck update: fw update stuck
- Receiver not working / no audio: no audio
- Faulty handset or LAN ports: hardware/ports
- LAN cable damaged / loose: cable/connection
- Bluetooth headset not connecting: BT pairing

Software:
- Notifications not working: notifications fail
- Voicemail not working / setup issues: VM config/access
- Softphone not working on Desktop: desktop softphone fails
- Softphone not working on Android: android softphone fails
- Softphone not working on iOS: iOS softphone fails
- Call park not working on app: app call park fails
- Number assignment errors: number assignment wrong
- Voicemail access errors: VM access errors
- Update or change label/name: label change
- Wrong practice timezone configuration: timezone wrong
- Call flow errors: routing/callflow errors

Product / Carrier Issues:
- Need isolation testing: isolation testing needed
- Whitelisting pending/not done: whitelisting incomplete
- Device-specific problems: device/model specific
- Server-related issues: server config/outage
- Carrier issue with Plivo: plivo carrier issue
- Carrier issue with Telnyx: telnyx carrier issue
- Porting not completed / failed: port stuck/failed
- Wrong or broken network configuration: network misconfig
- Receiver failure (audio issues): audio output failure
- Unable to send or open attachments: attachments fail

Audio Quality – Inbound:
- Internet speed too low: low bandwidth
- High call latency / delay: latency/delay
- Call fluctuations / instability: jitter/packet loss
- One-way audio (hear only one side): one-way
- Crackling/static noise: static
- Whitelisting required: needs whitelist
- Client expectation not met: below expectation

Audio Quality – Outbound:
- Internet speed too low: low upload
- High call latency / delay: latency/delay
- Call fluctuations / instability: jitter/packet loss
- One-way audio (hear only one side): one-way
- Crackling/static noise: static
- Whitelisting required: needs whitelist
- Client expectation not met: below expectation

Audio Quality – Both Directions:
- Internet speed too low: low bandwidth
- High call latency / delay: latency/delay
- Call fluctuations / instability: jitter/packet loss
- One-way audio (hear only one side): one-way
- Crackling/static noise: static
- Whitelisting required: needs whitelist
- Client expectation not met: below expectation

Caller Name / ID:
- Receiving spam calls: spam calls
- Wrong caller name displayed: name wrong
- Caller ID mismatch: CID mismatch
- Need to update label name: label update

General Enquiries:
- Request for product information: product info
- Asking for a new feature: feature request
- Questions on managing users: user mgmt
- Questions on managing permissions: permissions
- Client expectation queries: expectations

Custom Fix:
- Enable/disable hold reminder tone: hold tone
- Adjust timezone settings: timezone
- Change call waiting tone: waiting tone
- Error during upgrade (timeout): upgrade timeout
- Setup speed dials: speed dials
- Add more call park lines: more park lines
- Provide a feature-specific workaround: workaround

Bugs & Defects:
- Mobile app crashing: mobile crash
- Desktop app crashing: desktop crash
- Softphone bugs: softphone bugs
- Firmware-related bugs: firmware bugs
- Notifications not working: notification bug
- Unable to answer or hang up calls: answer/hangup fails
- Hardware defect: hardware defect
- Voicemail issues: VM bugs
- Hold music not working: hold music fails
- Audio library not working: audio library fails
- Software glitches: glitches
- Call tracking not working: call tracking fails
- Call flow not working: call flow fails
- Call override not working: override fails

Call Drop:
- Network issues causing call drop: network drops
- Firmware bug causing call drop: firmware drops
- Whitelisting pending/not done: whitelist drops

Installations:
- New phone installation: new install
- Replacement phone install: replacement install
- Partial phone installation: partial install
- V3 migration setup: v3 migration
- Bluetooth headset installation: BT headset setup

Training:
- Call Flow Training: call flow/IVR training
- Phone feature training: phone features
- Desktop app training: desktop app
- Mobile app training: mobile app
- Call override training: call override
- eFax training: eFax
- Block caller: block caller
- Hold music: hold music
- Audio library: audio library
- Multilocation call transfer: multi-location transfer
- Conference call setup: conference setup
- Enable patient card: enable patient card
- Enable call pop up: call pop up
- Call tracking: call tracking
- E911 Setup: E911
- Multiple Voicemail Box: multi VM box

Mass Texting:
- Not able to stop mass text: cannot stop
- Not able to select segment in mass text: cannot select segment

ASAP:
- Wrong patient appear in ASAP: wrong patients
- No patient in ASAP list: list empty

Internal Chat:
- Messages not received: not received
- Not able to delete chat: cannot delete
- Message delay: delayed

Others:
- Notification Missing: missing
- Notification read issue: cannot open
- Notification not redirecting: redirect fail
- Dual notification issue: duplicates
- App Lag Issue: app lag
- Server disconnection: disconnect if server off
- EHR Sync break: EHR sync broken
- Frequent Disconnect: frequent disconnects
- Adit app slow in web: web slow
- Adit app slow in desktop app: desktop slow
- Status mapping issue: status mapping wrong
- Wrong business hours: BH misconfig

Server App:
- EHR/PMS Disconnected Error on Adit app: disconnected
- Patient forms are not syncing: forms not syncing
- Reminders not going out: reminders blocked
- Payments not syncing: pay not syncing
- EHR disconnected: EHR down
- Practice Analytics not syncing: PA not syncing
- Server app resync: resync needed
- Server app reinstall: reinstall needed
- Server app install: install needed
- EHR change: EHR change needed
- EHR disconnection frequently: frequent disconnects
- Server system changed: system changed
- High CPU usage: high CPU
- EHR Crashing: EHR crash
- Server Crashing: server crash
- EHR upgrade: EHR upgrade
- Server App upgrade: server app upgrade
- Cloud EHR install: cloud install
- Chrome Extension not working: ext not working
- Chrome Extension installation: ext install

Adit Pay:
- Ledger Posting: not posting
- Payment Issue: payments issue
- Terminal Issues: terminal issue
- Hardware Replacement/Return: hardware RMA
- Demo/Basic Inquiry: demo/info
- Walkthrough Training: training
- Sign Up/Set Up: onboarding
- Terminal Registration: registration
- Price Comparison: price compare
- Feature Request: feature request
- Bugs/Outage: bugs/outage
- Configuration/Settings: config
- Basic Troubleshooting: troubleshooting
- EHR Disconnection: EHR disconnect
- Payment Failure: payment fails
- Payout Delay: payout delayed
- Refund Not Reflecting: refund missing

Practice Analytics:
- Sync: sync/load fails
- Data issues: data wrong
- Preferences: preferences/goals
- Training: training
- Upgrade to Analytics: upgrade request
- Feature Requests: feature request
- Patient list Requests: patient list help
- Export: export fails
- Daily, Weekly, Monthly Reports: report filters/view fail

Chat Issue:
- Chats not working: widget not opening
- Chats Deleted: auto-deleted
- Chats not syncing: not syncing

Bulk Issue:
- Bulk Upload / Import issue: import/upload fails
- Bulk SMS Issue: bulk SMS fails
- Bulk Email Issue: bulk email fails

Form Issue:
- Form not loading: not loading
- Form Submission Issue: submit fails
- Mapping Issue: mapping wrong

Review Issue:
- Reviews not coming: not syncing
- Review link not working: link broken

Billing Issue:
- Invoice Issue: invoice wrong/missing
- Refund Request: refund requested

Campaign Issue:
- Campaign not working: not sending
- Tracking Issue: tracking wrong

Call Tracking Issue:
- Number not working: number dead
- Call Forwarding Issue: forwarding wrong

Permission Issue:
- User Role Issue: wrong role
- Access Denied: access denied

Telemed Issue:
- Video Not Working: video fails
- Audio Not Working: audio fails
- Link Not Working: link invalid

Patient Sync Issue:
- Patient not syncing: missing patient
- Duplicate Patient: duplicates

Analytics Issue:
- Report Wrong: numbers wrong
- Dashboard not loading: dashboard fails

Appointment Issue:
- Unable to book appointment: booking fails
- Appointment not syncing: not in Adit/EHR
`;

// ------------ PROMPT ------------
const PROMPT = ({
  subject,
  status,
  priority,
  channel,
  department,
  conversation,
  ownerChangeLog,
  createdTime,
  closedTime,
  currentOwnerName,
  currentOwnerRole,
}) => `
You are an AI Ticket Audit Assistant. Analyze this Zoho Desk ticket for 360° agent performance using ONLY the provided data.

Business Hours (for SLA):
- Timezone: Central (America/Chicago)
- Business days: Monday–Friday
- Business window: 08:00–18:00
- Closed: Saturday, Sunday

SLA Rules (business-hours aware):
- First response within 30 minutes => within SLA; otherwise breach.
- Resolution within 4 hours => within SLA; otherwise breach.
Important: If a response/resolution occurs outside business hours, count time ONLY within business hours.

Ticket timestamps (may be empty):
- createdTime: ${createdTime || "(missing)"}
- closedTime: ${closedTime || "(missing)"}
- currentOwnerName: ${currentOwnerName || "(missing)"}
- currentOwnerRole: ${currentOwnerRole || "(missing)"}

IMPORTANT RULES FOR OWNER CHANGE LOG:
- Use the Owner Change Log timestamps to calculate time spent per user and per role (do not guess).
- Ignore system updates that do not change ownership.
- Always round durations to nearest 0.5 hr.
- Do not include customers/external users.

IMPORTANT RULE — WHEN OWNER CHANGE LOG IS EMPTY:
If Owner Change Log is null/empty/missing:
- Ticket stayed with current owner for FULL duration.
- FULL duration = (closedTime - createdTime) if closedTime exists else (now - createdTime).
Return EXACTLY:
"time_spent_per_user": "<Current Owner Name> – <full duration in hours>"
"time_spent_per_role": "<Current Owner Role> – <full duration in hours>"

1. FOLLOW-UP AUDIT:
Classify as exactly one:
- Follow-up Completed
- Delayed Follow-up
- Missed Follow-up
- No Commitment Found

2. CATEGORY, SUBCATEGORY & ISSUE SUMMARY (STRICT):
Use ONLY this list; do not invent names.
Return:
"category", "subcategory", "issue_summary" (use the exact summary text from the list):

REFERENCE LIST:
${REFERENCE_LIST}

3. SCORING (1–5 each, integers ONLY) — USE THIS FIXED RUBRIC EXACTLY:

A) FOLLOW-UP FREQUENCY (1–5)
1 = No follow-up at all; customer kept waiting >48 hours.
2 = Late follow-up; customer chased.
3 = Follow-ups done but sometimes delayed.
4 = Timely follow-ups, small delays only.
5 = Proactive, consistent, timely follow-ups.

B) NO DROPS (1–5)
1 = Ticket dropped or unassigned for long.
2 = Ownership gaps; stalled significantly.
3 = Minor stalls; recovered.
4 = Smooth handling with tiny gaps.
5 = Perfect continuity; no delays.

C) SLA ADHERENCE (1–5) — Take BUSINESS HOURS into account.
1 = First response >4h OR resolution >24h.
2 = First response >1h AND resolution >6h.
3 = First response 30–60m OR resolution 4–6h.
4 = First response <30m, resolution slightly late.
5 = Both within SLA comfortably.
If timestamps are missing/unclear, choose 3 and state "insufficient timestamp detail".

D) RESOLUTION QUALITY (1–5)
1 = Incorrect or unhelpful.
2 = Partially correct but unclear.
3 = Correct but missing clarity.
4 = Clear and complete.
5 = Exceptional clarity and proactive steps.

E) CUSTOMER SENTIMENT (1–5)
1 = Very negative or escalated.
2 = Negative or frustrated.
3 = Neutral or unclear.
4 = Positive or cooperative.
5 = Very appreciative and satisfied.

F) AGENT TONE (1–5)
1 = Rude or unprofessional.
2 = Mechanical and not empathetic.
3 = Neutral and correct.
4 = Warm and polite.
5 = Highly empathetic and personalized.

Provide 1–2 sentence reasons for each in "score_reasons".

4. FINAL SCORE (1–100):
Compute weighted score using:
Follow-up 15%, No Drops 15%, SLA 20%, Resolution 20%, Sentiment 15%, Tone 15%.
Convert each metric (1–5) to a 0–100 component:
component = ((score - 1) / 4) * 100
final_score = round(0.15*FU + 0.15*ND + 0.20*SLA + 0.20*RQ + 0.15*CS + 0.15*AT)

5. OWNER/TIME SUMMARY:
1 sentence about which team/owner had it longest.

6. TIME SPENT PER USER (MULTILINE):
Return multiline breakdown from owner log.

7. TIME SPENT PER ROLE (MULTILINE):
Return multiline breakdown from owner log.

Return a single JSON object only:
{
  "title": "Ticket Follow-up Analysis",
  "follow_up_status": "...",
  "category": "...",
  "subcategory": "...",
  "issue_summary": "...",
  "scores": {
    "follow_up_frequency": 1,
    "no_drops": 1,
    "sla_adherence": 1,
    "resolution_quality": 1,
    "customer_sentiment": 1,
    "agent_tone": 1
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
  "owner_time_summary": "one short sentence",
  "time_spent_per_user": "Name - 1.5 hrs\\nName2 - 2 hrs",
  "time_spent_per_role": "Role - 1.5 hrs\\nRole2 - 2 hrs"
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
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

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
        { role: "system", content: "Only output valid JSON. No markdown." },
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

// ------------ Follow-up mapping ------------
function normalizeFollowUpStatus(raw) {
  if (!raw) return "No Commitment Found";
  const s = raw.toString().toLowerCase();
  if (s.includes("completed")) return "Follow-up Completed";
  if (s.includes("delayed")) return "Delayed Follow-up";
  if (s.includes("missed")) return "Missed Follow-up";
  if (s.includes("no follow-up required") || s.includes("no commitment"))
    return "No Follow-up Required";
  return "No Commitment Found";
}

// ------------ Final score (compute in Node for reliability) ------------
function clamp15(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(5, Math.round(n)));
}
function toPct1to5(score) {
  const s = clamp15(score);
  return ((s - 1) / 4) * 100;
}
function computeFinalScore(scores = {}) {
  const FU = toPct1to5(scores.follow_up_frequency);
  const ND = toPct1to5(scores.no_drops);
  const SLA = toPct1to5(scores.sla_adherence);
  const RQ = toPct1to5(scores.resolution_quality);
  const CS = toPct1to5(scores.customer_sentiment);
  const AT = toPct1to5(scores.agent_tone);

  return Math.round(
    0.15 * FU +
      0.15 * ND +
      0.2 * SLA +
      0.2 * RQ +
      0.15 * CS +
      0.15 * AT
  );
}

// ------------ (Optional) business-hours helper (for future use) ------------
function parseDateSafe(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? d : null;
}
// NOTE: Full business-hours elapsed computation can be added if you later want
// to compute SLA durations in Node rather than letting the LLM infer from logs.

// ------------ Update Zoho Desk ticket ------------
async function updateDeskTicket(ticketId, aiResult) {
  if (!ZOHO_OAUTH_TOKEN || !ZOHO_ORG_ID) {
    console.warn("ZOHO_OAUTH_TOKEN or ZOHO_ORG_ID missing; skipping Desk update.");
    return { skipped: true };
  }

  const scores = aiResult.scores || {};
  // normalize and enforce valid ints 1..5
  const normalizedScores = {
    follow_up_frequency: clamp15(scores.follow_up_frequency),
    no_drops: clamp15(scores.no_drops),
    sla_adherence: clamp15(scores.sla_adherence),
    resolution_quality: clamp15(scores.resolution_quality),
    customer_sentiment: clamp15(scores.customer_sentiment),
    agent_tone: clamp15(scores.agent_tone),
  };

  const scoreReasons = aiResult.score_reasons || {};
  const followUpStatus = normalizeFollowUpStatus(aiResult.follow_up_status);

  const ownerTimeRemark = aiResult.owner_time_summary || "";
  const aiMainSummary = aiResult.reasons || "";
  const timeSpentPerUser = aiResult.time_spent_per_user || "";
  const timeSpentPerRole = aiResult.time_spent_per_role || "";
  const issueSummary = aiResult.issue_summary || "";

  const finalScore100 = computeFinalScore(normalizedScores);
  aiResult.final_score = finalScore100;

  // ---- custom fields by LABEL (Zoho Desk UI labels) ----
  const customFields = {
    "Follow-up Status": followUpStatus,
    "AI Category": aiResult.category || "",
    "AI Sub Category": aiResult.subcategory || "",
    "AI Final Score": finalScore100, // 0–100
    "AI Category explanation": aiMainSummary,

    "Follow-Up Frequency": normalizedScores.follow_up_frequency,
    "No Drops Score": normalizedScores.no_drops,
    "SLA Adherence": normalizedScores.sla_adherence,
    "Resolution Quality": normalizedScores.resolution_quality,
    "Customer Sentiment": normalizedScores.customer_sentiment,
    "Agent Tone": normalizedScores.agent_tone,

    "Reason Follow-Up Frequency": scoreReasons.follow_up_frequency || "",
    "Reason No Drops": scoreReasons.no_drops || "",
    "Reasons SLA Adherence": scoreReasons.sla_adherence || "",
    "Reason Resolution Quality": scoreReasons.resolution_quality || "",
    "Reason Customer Sentiment": scoreReasons.customer_sentiment || "",
    "Reason Agent Tone": scoreReasons.agent_tone || "",

    "Remarks-OC Log": ownerTimeRemark,

    // multi-line fields (create in Zoho Desk)
    "Time Spent Per User": timeSpentPerUser,
    "Time Spent Per Role": timeSpentPerRole,
    "Issue Summary": issueSummary,
  };

  // ---- custom fields by API NAME ----
  // IMPORTANT: Replace these cf_* API names with your actual Zoho Desk custom field API names.
  const body = {
    customFields,
    cf: {
      cf_ai_category_explanation: aiMainSummary,
      cf_remarks_oc_log: ownerTimeRemark,
      cf_ts_resolution: ownerTimeRemark,

      // multiline (adjust)
      cf_csm_resolution: timeSpentPerUser,
      cf_voip_resolution: timeSpentPerRole,
      cf_tech_csm_resolution: issueSummary,

      // final score (adjust if you store separately)
      // cf_ai_final_score: finalScore100,
    },
  };

  console.log("Desk update payload:", JSON.stringify(body).slice(0, 900));

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
  console.log("Desk update response:", r.status, JSON.stringify(data).slice(0, 1200));
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
      // OPTIONAL fields if you can include them from your webhook payload:
      createdTime = "",
      closedTime = "",
      currentOwnerName = "",
      currentOwnerRole = "",
    } = body;

    console.log("Webhook hit:", JSON.stringify({ ticket_id, subject }).slice(0, 400));

    const prompt = PROMPT({
      subject,
      status,
      priority,
      channel,
      department,
      conversation,
      ownerChangeLog: owner_change_log,
      createdTime,
      closedTime,
      currentOwnerName,
      currentOwnerRole,
    });

    const ai = await callOpenAI(prompt);

    // Ensure final_score is computed as 0–100 in Node
    ai.final_score = computeFinalScore(ai.scores || {});

    let deskResult = { skipped: true };
    if (ticket_id) {
      deskResult = await updateDeskTicket(ticket_id, ai);
    } else {
      console.warn("No ticket_id in payload; skipping Desk update.");
    }

    return res.json({ ok: true, ai, desk: deskResult });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
});

// ------------ Start server ------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
