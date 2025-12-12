// server.js
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ------------ ENV VARS ------------
const DESK_SHARED_SECRET = process.env.DESK_SHARED_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

// Access token (optional; short-lived). If missing/invalid, we'll refresh using refresh token flow.
let DESK_OAUTH_TOKEN = process.env.DESK_OAUTH_TOKEN;

// Refresh flow vars (recommended)
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_ACCOUNTS_DOMAIN =
  process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";

// Optional: label of a multiline custom field to store Owner Change Log
const OWNER_CHANGE_LOG_LABEL =
  process.env.OWNER_CHANGE_LOG_LABEL || "Owner Change Log";

// If Zoho numeric fields reject null, set NA_NUMERIC_STRATEGY=zero
const NA_NUMERIC_STRATEGY = (
  process.env.NA_NUMERIC_STRATEGY || "null"
).toLowerCase(); // "null" | "zero"

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

Website Edits Issues:
- website Edit: Page not updating
- website Edits: Broken Links

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
// (Note: we won’t call AI for single-thread tickets at all; this prompt is for multi-thread tickets.)
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
You are an AI Ticket Audit Assistant. Analyze this Zoho Desk ticket for agent performance using ONLY the provided ticket data.

Rubric (score 1–5 integers):


Final Score 1–100:
weights: Follow-up 15, No Drops 15, SLA 20, Resolution 20, Sentiment 15, Tone 15
Convert 1–5 to percent: ((score-1)/4)*100.
final_score = round(sum(percent_i * weight_i / 100))

CATEGORY/SUBCATEGORY (STRICT):
Use ONLY exact labels from Reference List (Category -> Subcategory -> Issue Summary).
Do not invent names.

REFERENCE LIST:
${REFERENCE_LIST}

Owner Change Log:
- Use timestamps only to compute time per owner/role; round nearest 0.5h.
- If empty/missing: current owner held full duration (closedTime-createdTime else now-createdTime).

Ticket timestamps:
createdTime: ${createdTime || "(missing)"}
closedTime: ${closedTime || "(missing)"}
currentOwnerName: ${currentOwnerName || "(missing)"}
currentOwnerRole: ${currentOwnerRole || "(missing)"}

Return JSON ONLY:
{
  "title": "Ticket Follow-up Analysis",
  "follow_up_status": "Follow-up Completed|Delayed Follow-up|Missed Follow-up|No Commitment Found",
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

// ------------ Zoho token refresh ------------
async function refreshZohoAccessTokenIfPossible() {
  if (!ZOHO_REFRESH_TOKEN || !ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) return null;

  const url = `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token`;
  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const r = await fetch(`${url}?${params.toString()}`, { method: "POST" });
  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data.access_token) {
    console.error("Zoho token refresh failed:", r.status, data);
    return null;
  }
  DESK_OAUTH_TOKEN = data.access_token;
  return DESK_OAUTH_TOKEN;
}

async function getZohoAccessToken() {
  if (DESK_OAUTH_TOKEN) return DESK_OAUTH_TOKEN;
  const t = await refreshZohoAccessTokenIfPossible();
  return t;
}

// ------------ Desk API helpers ------------
async function deskGetTicket(ticketId) {
  const tok = await getZohoAccessToken();
  if (!tok) throw new Error("No Zoho access token available");

  const r = await fetch(`https://desk.zoho.com/api/v1/tickets/${ticketId}`, {
    method: "GET",
    headers: { Authorization: `Zoho-oauthtoken ${tok}`, orgId: ZOHO_ORG_ID },
  });
  const data = await r.json().catch(() => ({}));

  // if token invalid, refresh and retry once
  if (
    r.status === 401 &&
    (data?.errorCode === "INVALID_OAUTH" ||
      `${data?.message || ""}`.toLowerCase().includes("invalid"))
  ) {
    const nt = await refreshZohoAccessTokenIfPossible();
    if (!nt) return data;
    const r2 = await fetch(`https://desk.zoho.com/api/v1/tickets/${ticketId}`, {
      method: "GET",
      headers: { Authorization: `Zoho-oauthtoken ${nt}`, orgId: ZOHO_ORG_ID },
    });
    return await r2.json().catch(() => ({}));
  }

  return data;
}

async function deskPatchTicket(ticketId, body) {
  const tok = await getZohoAccessToken();
  if (!tok) throw new Error("No Zoho access token available");

  async function patchWith(token) {
    const r = await fetch(`https://desk.zoho.com/api/v1/tickets/${ticketId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        orgId: ZOHO_ORG_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    return { r, data };
  }

  let { r, data } = await patchWith(tok);

  if (
    r.status === 401 &&
    (data?.errorCode === "INVALID_OAUTH" ||
      `${data?.message || ""}`.toLowerCase().includes("invalid"))
  ) {
    const nt = await refreshZohoAccessTokenIfPossible();
    if (nt) ({ r, data } = await patchWith(nt));
  }

  return { status: r.status, data };
}

// ------------ Single-thread detection ------------
function isSingleThread({ thread_count, conversation, conversationCount }) {
  // Best: explicit thread_count from webhook
  if (Number.isFinite(Number(thread_count))) return Number(thread_count) <= 1;

  // Next: explicit conversationCount
  if (Number.isFinite(Number(conversationCount))) return Number(conversationCount) <= 1;

  // Heuristic: count timestamp-like markers in the conversation string
  if (typeof conversation !== "string" || !conversation.trim()) return true;

  // Common patterns seen in your payloads:
  // 0000[2025-11-28T13:32:09.604Z] ...
  // [2025-11-27T18:43:25.000Z] ...
  const matches =
    conversation.match(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g) || [];

  // If we can’t find timestamps, fall back to lines containing "User:" / "Agent:" style
  const msgMarkers =
    conversation.match(/(^|\n)\s*(user|agent|customer|support)\s*:/gi) || [];

  const approxMessages = Math.max(matches.length, msgMarkers.length);

  return approxMessages <= 1;
}

// ------------ Owner Change Log normalization ------------
function buildOwnerLogWhenEmpty({ currentOwnerName, currentOwnerRole, createdTime, closedTime }) {
  const owner = currentOwnerName || "Current Owner";
  const role = currentOwnerRole || "Current Owner Role";
  const ct = createdTime || "(createdTime missing)";
  const xt = closedTime || "(closed/now missing)";
  return `Auto-filled (owner_change_log was empty)
Owner: ${owner}
Role: ${role}
From: ${ct}
To: ${xt}`;
}

// ------------ Follow-up mapping ------------
function normalizeFollowUpStatus(raw) {
  if (!raw) return "No Commitment Found";
  const s = raw.toString().toLowerCase();
  if (s.includes("completed")) return "Follow-up Completed";
  if (s.includes("delayed")) return "Delayed Follow-up";
  if (s.includes("missed")) return "Missed Follow-up";
  return "No Commitment Found";
}

// ------------ Scoring helpers ------------
function clampScore15(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}
function scoreToPct(score1to5) {
  const s = clampScore15(score1to5);
  if (s === null) return null;
  return ((s - 1) / 4) * 100;
}
function computeFinalScore100(scores = {}) {
  // Fixed weights, always present for multi-thread tickets (since we’re skipping single-thread entirely)
  const weights = {
    follow_up_frequency: 15,
    no_drops: 15,
    sla_adherence: 20,
    resolution_quality: 20,
    customer_sentiment: 15,
    agent_tone: 15,
  };
  const keys = Object.keys(weights);

  // Convert to pct and compute weighted average
  let sumW = 0;
  let sum = 0;
  for (const k of keys) {
    const pct = scoreToPct(scores[k]);
    const w = weights[k];
    if (pct === null) continue;
    sumW += w;
    sum += pct * (w / 100);
  }
  if (!sumW) return 0;
  // If something missing, renormalize
  const renorm = sum * (100 / sumW);
  return Math.round(renorm);
}
function zohoNumericNA(v) {
  if (v !== null && v !== undefined) return v;
  return NA_NUMERIC_STRATEGY === "zero" ? 0 : null;
}

// ------------ Update Zoho Desk ticket (full AI writeback) ------------
async function updateDeskTicket(ticketId, aiResult) {
  if (!ZOHO_ORG_ID) {
    console.warn("ZOHO_ORG_ID missing; skipping Desk update.");
    return { skipped: true };
  }

  const scores = aiResult.scores || {};
  const scoreReasons = aiResult.score_reasons || {};

  const normalizedScores = {
    follow_up_frequency: clampScore15(scores.follow_up_frequency),
    no_drops: clampScore15(scores.no_drops),
    sla_adherence: clampScore15(scores.sla_adherence),
    resolution_quality: clampScore15(scores.resolution_quality),
    customer_sentiment: clampScore15(scores.customer_sentiment),
    agent_tone: clampScore15(scores.agent_tone),
  };

  const followUpStatus = normalizeFollowUpStatus(aiResult.follow_up_status);
  const ownerTimeRemark = aiResult.owner_time_summary || "";
  const aiMainSummary = aiResult.reasons || "";
  const timeSpentPerUser = aiResult.time_spent_per_user || "";
  const timeSpentPerRole = aiResult.time_spent_per_role || "";
  const issueSummary = aiResult.issue_summary || "";

  const finalScore100 = computeFinalScore100(normalizedScores);

  const customFields = {
    "Follow-up Status": followUpStatus,
    "AI Category": aiResult.category || "",
    "AI Sub Category": aiResult.subcategory || "",
    "AI Final Score": finalScore100,
    "AI Category explanation": aiMainSummary,

    "Follow-Up Frequency": zohoNumericNA(normalizedScores.follow_up_frequency),
    "No Drops Score": zohoNumericNA(normalizedScores.no_drops),
    "SLA Adherence": zohoNumericNA(normalizedScores.sla_adherence),
    "Resolution Quality": zohoNumericNA(normalizedScores.resolution_quality),
    "Customer Sentiment": zohoNumericNA(normalizedScores.customer_sentiment),
    "Agent Tone": zohoNumericNA(normalizedScores.agent_tone),

    "Reason Follow-Up Frequency": scoreReasons.follow_up_frequency || "",
    "Reason No Drops": scoreReasons.no_drops || "",
    "Reasons SLA Adherence": scoreReasons.sla_adherence || "",
    "Reason Resolution Quality": scoreReasons.resolution_quality || "",
    "Reason Customer Sentiment": scoreReasons.customer_sentiment || "",
    "Reason Agent Tone": scoreReasons.agent_tone || "",

    "Remarks-OC Log": ownerTimeRemark,
    "Time Spent Per User": timeSpentPerUser,
    "Time Spent Per Role": timeSpentPerRole,
    "Issue Summary": issueSummary,
  };

  const body = { customFields };

  console.log("Desk update payload:", JSON.stringify(body).slice(0, 900));
  const result = await deskPatchTicket(ticketId, body);
  console.log(
    "Desk update response:",
    result.status,
    JSON.stringify(result.data).slice(0, 900)
  );
  return result;
}

// ------------ Update only Owner Change Log (when empty) ------------
async function updateOwnerChangeLogOnly(ticketId, ownerLogText) {
  if (!ticketId || !ownerLogText) return { skipped: true };
  if (!ZOHO_ORG_ID) return { skipped: true };

  const body = { customFields: { [OWNER_CHANGE_LOG_LABEL]: ownerLogText } };
  console.log(
    "Owner Change Log auto-fill payload:",
    JSON.stringify(body).slice(0, 700)
  );

  const result = await deskPatchTicket(ticketId, body);
  console.log(
    "Owner Change Log auto-fill response:",
    result.status,
    JSON.stringify(result.data).slice(0, 700)
  );
  return result;
}

// ------------ Health check ------------
app.get("/", (_req, res) => res.send("✅ Railway app is live!"));

// ------------ Webhook ------------
app.post("/desk-webhook", async (req, res) => {
  try {
    const secret = req.headers["desk-shared-secret"];
    if (!secret || secret !== DESK_SHARED_SECRET) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!ZOHO_ORG_ID) {
      return res.status(500).json({ error: "ZOHO_ORG_ID missing" });
    }

    const body = req.body || {};
    let {
      ticket_id,
      subject = "N/A",
      status = "N/A",
      priority = "N/A",
      channel = "N/A",
      department = "N/A",
      conversation = "",
      owner_change_log = "",

      // optional fields if webhook provides them
      createdTime = "",
      closedTime = "",
      currentOwnerName = "",
      currentOwnerRole = "",
      thread_count = undefined, // preferred if available
    } = body;

    console.log(
      "Webhook hit:",
      JSON.stringify({ ticket_id, subject }).slice(0, 400)
    );

    // If we have ticket_id, fetch ticket to enrich missing fields AND get threadCount
    let deskTicket = null;
    if (ticket_id) {
      try {
        deskTicket = await deskGetTicket(ticket_id);
      } catch (e) {
        console.warn("Could not fetch ticket details from Desk:", e?.message || e);
      }
    }

    // Fill missing fields from Desk response if available
    if (deskTicket && typeof deskTicket === "object") {
      createdTime = createdTime || deskTicket?.createdTime || "";
      closedTime = closedTime || deskTicket?.closedTime || "";
      channel = channel || deskTicket?.channel || "N/A";
      status = status || deskTicket?.status || "N/A";
      priority = priority || deskTicket?.priority || "N/A";
      department = department || deskTicket?.departmentId || department;

      // Try a few common owner structures
      currentOwnerName =
        currentOwnerName ||
        deskTicket?.assignee?.name ||
        deskTicket?.assignee?.email ||
        deskTicket?.owner?.name ||
        "";

      // Role can be whatever you want; if you have real role metadata, pass it in webhook.
      currentOwnerRole = currentOwnerRole || "Agent";

      // thread count if desk returns it
      if (thread_count === undefined) {
        thread_count =
          deskTicket?.threadCount ??
          deskTicket?.thread_count ??
          deskTicket?.threadcount ??
          undefined;
      }
    }

    const singleThread = isSingleThread({
      thread_count,
      conversation,
      conversationCount: body?.conversation_count,
    });

    // If owner_change_log is empty, always fill Owner Change Log field with current owner info
    const ownerLogEmpty = !owner_change_log || !String(owner_change_log).trim();
    if (ownerLogEmpty && ticket_id) {
      const ownerLogText = buildOwnerLogWhenEmpty({
        currentOwnerName,
        currentOwnerRole,
        createdTime,
        closedTime,
      });

      // Update this field in Desk (even if we skip AI)
      await updateOwnerChangeLogOnly(ticket_id, ownerLogText);

      // Also use this for AI if needed later
      owner_change_log = ownerLogText;
    }

    // ✅ Desired behavior: if only one thread, SKIP AI update
    if (singleThread) {
      return res.json({
        ok: true,
        skipped: true,
        reason: "single_thread_ticket",
        owner_change_log_filled: ownerLogEmpty,
      });
    }

    // Otherwise proceed with AI scoring + update
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

    // Force final score server-side (ensures 1–100 weighting consistent)
    ai.final_score = computeFinalScore100(ai.scores || {});

    let deskResult = { skipped: true };
    if (ticket_id) deskResult = await updateDeskTicket(ticket_id, ai);
    else console.warn("No ticket_id in payload; skipping Desk update.");

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
app.listen(PORT, () => console.log("Server running on port", PORT));
