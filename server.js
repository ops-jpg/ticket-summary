import express from "express";

const app = express();
app.use(express.json({ limit: "2mb" }));

/**
 * =========================
 * ENV VARS
 * =========================
 */
const DESK_SHARED_SECRET = process.env.DESK_SHARED_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

// Field labels (only used as fallback if API name fails)
const THREAD_COUNT_FIELD_LABEL =
  process.env.THREAD_COUNT_FIELD_LABEL || "Number of Threads";
const OWNER_CHANGE_LOG_LABEL =
  process.env.OWNER_CHANGE_LOG_LABEL || "Owner Change Log";
const FINAL_SCORE_FIELD_LABEL =
  process.env.FINAL_SCORE_FIELD_LABEL || "Final Score";
const BRIEF_AI_SUMMARY_FIELD_LABEL =
  process.env.BRIEF_AI_SUMMARY_FIELD_LABEL || "Brief AI Summary";
const REMARKS_OC_LOG_FIELD_LABEL =
  process.env.REMARKS_OC_LOG_FIELD_LABEL || "Remarks-OC Log";

const LLM_CATEGORY_FIELD_LABEL =
  process.env.LLM_CATEGORY_FIELD_LABEL || "AI Category by LLM";
const LLM_SUBCATEGORY_FIELD_LABEL =
  process.env.LLM_SUBCATEGORY_FIELD_LABEL || "AI SubCategory by LLM";

// ✅ API Names (as you provided)
const CF_NUMBER_OF_THREADS = "cf_number_of_threads";
const CF_LLM_CATEGORY = "cf_ai_category_by_llm";
const CF_LLM_SUBCATEGORY = "cf_ai_sub_category_by_llm";

// If Zoho numeric fields reject null, set NA_NUMERIC_STRATEGY=zero
const NA_NUMERIC_STRATEGY = (process.env.NA_NUMERIC_STRATEGY || "null").toLowerCase(); // "null" | "zero"

// Zoho OAuth
let DESK_OAUTH_TOKEN = process.env.DESK_OAUTH_TOKEN;
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_ACCOUNTS_DOMAIN =
  process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";

/**
 * =========================
 * REFERENCE LIST
 * =========================
 * Prefer env var to avoid huge file edits.
 * If env is empty, you can paste your big list in DEFAULT_REFERENCE_LIST.
 */
const DEFAULT_REFERENCE_LIST = `

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


const REFERENCE_LIST = (process.env.REFERENCE_LIST || DEFAULT_REFERENCE_LIST).trim();

/**
 * =========================
 * PROMPT (adds llm_category fields)
 * =========================
 */
const PROMPT = ({
  subject,
  status,
  priority,
  channel,
  department,
  conversation,
  createdTime,
  closedTime,
  currentOwnerName,
  currentOwnerRole,
}) => `
You are an AI Ticket Audit Assistant. Analyze this Zoho Desk ticket for agent performance using ONLY the provided ticket data.

HARD RULES:
- If there are multiple messages/threads, you MUST evaluate fully.
- Do NOT say "not enough data" when multiple messages exist.
- Scores must be integers 1–5 OR "NA". Never output 0.
- If a metric truly does not apply, output "NA".
- Do NOT compute time spent, owner time, or final score. Server handles that.
- Return VALID JSON ONLY (no markdown, no extra text).

CATEGORY/SUBCATEGORY (STRICT):
- category and subcategory MUST be chosen ONLY from the Reference List (exact match).
- Do NOT invent labels.

LLM RAW SUGGESTIONS (NOT STRICT):
- llm_category and llm_subcategory can be free-text best guess.
- Used only to populate "AI Category by LLM" fields.

REFERENCE LIST:
${REFERENCE_LIST}

Ticket timestamps:
createdTime: ${createdTime || "(missing)"}
closedTime: ${closedTime || "(missing)"}
currentOwnerName: ${currentOwnerName || "(missing)"}
currentOwnerRole: ${currentOwnerRole || "(missing)"}

Return JSON ONLY:
{
  "follow_up_status": "Follow-up Completed|Delayed Follow-up|Missed Follow-up|No Commitment Found",
  "category": "",
  "subcategory": "",
  "llm_category": "",
  "llm_subcategory": "",
  "issue_summary": "",
  "brief_ai_summary": "",
  "scores": {
    "follow_up_frequency": 1|2|3|4|5|"NA",
    "no_drops": 1|2|3|4|5|"NA",
    "sla_adherence": 1|2|3|4|5|"NA",
    "resolution_quality": 1|2|3|4|5|"NA",
    "customer_sentiment": 1|2|3|4|5|"NA",
    "agent_tone": 1|2|3|4|5|"NA"
  },
  "score_reasons": {
    "follow_up_frequency": "",
    "no_drops": "",
    "sla_adherence": "",
    "resolution_quality": "",
    "customer_sentiment": "",
    "agent_tone": ""
  },
  "reasons": ""
}

Ticket:
Subject: ${subject}
Status: ${status}
Priority: ${priority}
Channel: ${channel}
Department: ${department}
Conversation:
${conversation || "(empty)"}
`;

/**
 * =========================
 * OpenAI caller
 * =========================
 */
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

/**
 * =========================
 * Zoho token refresh
 * =========================
 */
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
  return await refreshZohoAccessTokenIfPossible();
}

/**
 * =========================
 * Desk API helpers
 * =========================
 */
async function deskGetTicket(ticketId) {
  const tok = await getZohoAccessToken();
  if (!tok) throw new Error("No Zoho access token available");

  const r = await fetch(`https://desk.zoho.com/api/v1/tickets/${ticketId}`, {
    method: "GET",
    headers: {
      Authorization: `Zoho-oauthtoken ${tok}`,
      orgId: ZOHO_ORG_ID,
    },
  });

  const data = await r.json().catch(() => ({}));

  if (
    r.status === 401 &&
    (data?.errorCode === "INVALID_OAUTH" ||
      `${data?.message || ""}`.toLowerCase().includes("invalid"))
  ) {
    const nt = await refreshZohoAccessTokenIfPossible();
    if (!nt) return data;

    const r2 = await fetch(`https://desk.zoho.com/api/v1/tickets/${ticketId}`, {
      method: "GET",
      headers: {
        Authorization: `Zoho-oauthtoken ${nt}`,
        orgId: ZOHO_ORG_ID,
      },
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

/**
 * =========================
 * Helpers
 * =========================
 */
function setField(customFields, apiName, labelName, value) {
  if (apiName && String(apiName).trim()) customFields[String(apiName).trim()] = value;
  if (labelName && String(labelName).trim()) customFields[String(labelName).trim()] = value;
}

function getThreadCountFromDeskTicket(deskTicket) {
  const tc =
    deskTicket?.threadCount ??
    deskTicket?.thread_count ??
    deskTicket?.threadcount ??
    undefined;

  if (tc === undefined || tc === null || tc === "") return null;

  const n = Number(tc);
  return Number.isFinite(n) ? n : null;
}


function buildOwnerLogWhenEmpty({ currentOwnerName, currentOwnerRole }) {
  const owner = (currentOwnerName || "").trim();
  if (!owner) return "";
  const role = (currentOwnerRole || "Agent").trim();
  return `Owner: ${owner}\nRole: ${role}`;
}

function normalizeKey(k) {
  return String(k || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function clampScore15(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 3;
  const r = Math.round(n);
  return Math.max(1, Math.min(5, r));
}

function normalizeScores(aiScores) {
  const out = {
    follow_up_frequency: 3,
    no_drops: 3,
    sla_adherence: 3,
    resolution_quality: 3,
    customer_sentiment: 3,
    agent_tone: 3,
  };

  if (!aiScores || typeof aiScores !== "object") return out;

  const normalizedInput = {};
  for (const [k, v] of Object.entries(aiScores)) {
    normalizedInput[normalizeKey(k)] = v;
  }

  const map = {
    follow_up_frequency: ["follow_up_frequency", "followup_frequency", "follow_up_freq"],
    no_drops: ["no_drops", "nodrops", "no_drop"],
    sla_adherence: ["sla_adherence", "sla", "sla_score"],
    resolution_quality: ["resolution_quality", "resolution", "quality"],
    customer_sentiment: ["customer_sentiment", "sentiment"],
    agent_tone: ["agent_tone", "tone"],
  };

  for (const [target, variants] of Object.entries(map)) {
    for (const v of variants) {
      const hit = normalizedInput[normalizeKey(v)];
      if (hit === undefined) continue;

      if (typeof hit === "string" && hit.trim().toUpperCase() === "NA") {
        out[target] = "NA";
        break;
      }

      if (hit !== null && hit !== "") {
        out[target] = clampScore15(hit);
        break;
      }
    }
  }

  return out;
}

function computeFinalScore100(scores) {
  const weights = {
    follow_up_frequency: 15,
    no_drops: 15,
    sla_adherence: 20,
    resolution_quality: 20,
    customer_sentiment: 15,
    agent_tone: 15,
  };

  let usedWeight = 0;
  let total = 0;

  for (const [k, w] of Object.entries(weights)) {
    const v = scores[k];
    if (v === "NA") continue;
    const pct = ((v - 1) / 4) * 100;
    total += pct * w;
    usedWeight += w;
  }

  if (usedWeight === 0) return null;
  return Math.round(total / usedWeight);
}

function zohoNumericNA(v) {
  if (v === "NA") return NA_NUMERIC_STRATEGY === "zero" ? 0 : null;
  if (v !== null && v !== undefined) return v;
  return NA_NUMERIC_STRATEGY === "zero" ? 0 : null;
}

function normalizeFollowUpStatus(raw) {
  if (!raw) return "No Commitment Found";
  const s = raw.toString().toLowerCase();
  if (s.includes("completed")) return "Follow-up Completed";
  if (s.includes("delayed")) return "Delayed Follow-up";
  if (s.includes("missed")) return "Missed Follow-up";
  return "No Commitment Found";
}

/**
 * =========================
 * Owner log parsing (your format)
 * =========================
 * Example lines:
 * Owner changed to Paul Mason on 2025-12-11 10:24:42 Role :VoIP Support
 * Owner changed to Paul Mason on 2025-12-11 15:18:14 .
 */
function parseOwnerChangeLog(ownerChangeLogText) {
  const raw = String(ownerChangeLogText || "").trim();
  if (!raw) return [];

  const normalized = raw.replace(/\r\n/g, "\n");
  const lines = normalized
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const events = [];
  for (const line of lines) {
    const m = line.match(
      /^Owner\s+changed\s+to\s+(.+?)\s+on\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(?:\s+Role\s*[:\-]\s*(.+?))?\s*\.?\s*$/i
    );
    if (!m) continue;

    const owner = (m[1] || "").trim();
    const datePart = (m[2] || "").trim();
    const timePart = (m[3] || "").trim();
    const role = (m[4] || "").trim();

    const dt = new Date(`${datePart}T${timePart}`);
    if (owner && !Number.isNaN(dt.getTime())) {
      events.push({ time: dt, owner, role });
    }
  }

  events.sort((a, b) => a.time - b.time);
  return events;
}

function roundToNearestHalfHour(hours) {
  return Math.round(hours * 2) / 2;
}

function formatHours(h) {
  return `${roundToNearestHalfHour(h)} hrs`;
}

function calculateTimeSpentPerUserAndRole({
  ownerChangeLog,
  createdTime,
  closedTime,
  fallbackOwnerName,
  fallbackOwnerRole,
}) {
  const start = createdTime ? new Date(createdTime) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return { perUserText: "", perRoleText: "", ownerTimeSummary: "" };
  }

  const end = closedTime ? new Date(closedTime) : new Date();
  const endTime = Number.isNaN(end.getTime()) ? new Date() : end;

  const events = parseOwnerChangeLog(ownerChangeLog).filter(
    (e) => e.time >= start && e.time <= endTime
  );

  const timeline = [];

  if (!events.length) {
    const owner = (fallbackOwnerName || "").trim();
    if (!owner) return { perUserText: "", perRoleText: "", ownerTimeSummary: "" };
    timeline.push({
      owner,
      role: (fallbackOwnerRole || "Agent").trim(),
      from: start,
      to: endTime,
    });
  } else {
    const initialOwner = (fallbackOwnerName || "").trim();
    const initialRole = (fallbackOwnerRole || "Agent").trim();

    if (initialOwner && events[0].time > start) {
      timeline.push({
        owner: initialOwner,
        role: initialRole,
        from: start,
        to: events[0].time,
      });
    }

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const next = events[i + 1];
      const from = e.time < start ? start : e.time;
      const to = next ? next.time : endTime;
      if (to <= from) continue;

      timeline.push({
        owner: e.owner,
        role: (e.role || "").trim() || "Agent",
        from,
        to,
      });
    }
  }

  const perUser = new Map();
  const perRole = new Map();

  for (const seg of timeline) {
    const ms = seg.to.getTime() - seg.from.getTime();
    if (ms <= 0) continue;
    const hrs = ms / (1000 * 60 * 60);

    perUser.set(seg.owner, (perUser.get(seg.owner) || 0) + hrs);
    perRole.set(seg.role, (perRole.get(seg.role) || 0) + hrs);
  }

  const perUserText = [...perUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, hrs]) => `${name} - ${formatHours(hrs)}`)
    .join("\n");

  const perRoleText = [...perRole.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([role, hrs]) => `${role} - ${formatHours(hrs)}`)
    .join("\n");

  const ownerTimeSummary = perUserText
    ? `Owner time split: ${perUserText.replace(/\n/g, " | ")}`
    : "";

  return { perUserText, perRoleText, ownerTimeSummary };
}

/**
 * =========================
 * Desk writeback
 * =========================
 */
async function updateThreadCountOnly(ticketId, threadCount) {
  if (!ticketId) return { skipped: true };
  if (!Number.isFinite(Number(threadCount))) return { skipped: true };

  const customFields = {};
  setField(customFields, CF_NUMBER_OF_THREADS, THREAD_COUNT_FIELD_LABEL, Number(threadCount));

  const body = { customFields };
  console.log("ThreadCount payload:", JSON.stringify(body));
  return await deskPatchTicket(ticketId, body);
}

async function updateOwnerChangeLogOnly(ticketId, ownerLogText) {
  if (!ticketId || !ownerLogText) return { skipped: true };
  const body = { customFields: { [OWNER_CHANGE_LOG_LABEL]: ownerLogText } };
  console.log("Owner Change Log payload:", JSON.stringify(body));
  return await deskPatchTicket(ticketId, body);
}

async function updateDeskTicket(ticketId, { aiResult, threadCount, timeSpent }) {
  const scores = normalizeScores(aiResult?.scores);
  const scoreReasons = aiResult?.score_reasons || {};

  const finalScore100 = computeFinalScore100(scores);

  const reasonOrNA = (key) => {
    const base = (scoreReasons?.[key] || "").trim();
    if (scores[key] === "NA") return base ? `NA - ${base}` : "NA - Not applicable";
    return base;
  };

  const brief =
    (aiResult?.brief_ai_summary || "").trim() ||
    (aiResult?.reasons || "").trim().split("\n")[0].slice(0, 220);

  const remarksOc = (timeSpent?.ownerTimeSummary || "").trim() || "";

  const customFields = {
    "Follow-Up Frequency": zohoNumericNA(scores.follow_up_frequency),
    "No Drops Score": zohoNumericNA(scores.no_drops),
    "SLA Adherence": zohoNumericNA(scores.sla_adherence),
    "Resolution Quality": zohoNumericNA(scores.resolution_quality),
    "Customer Sentiment": zohoNumericNA(scores.customer_sentiment),
    "Agent Tone": zohoNumericNA(scores.agent_tone),

    "Reason Follow-Up Frequency": reasonOrNA("follow_up_frequency"),
    "Reason No Drops": reasonOrNA("no_drops"),
    "Reasons SLA Adherence": reasonOrNA("sla_adherence"),
    "Reason Resolution Quality": reasonOrNA("resolution_quality"),
    "Reason Customer Sentiment": reasonOrNA("customer_sentiment"),
    "Reason Agent Tone": reasonOrNA("agent_tone"),

    "Follow-up Status": normalizeFollowUpStatus(aiResult?.follow_up_status),
    "AI Category": aiResult?.category || "",
    "AI Sub Category": aiResult?.subcategory || "",
    "Issue Summary": aiResult?.issue_summary || "",

    [FINAL_SCORE_FIELD_LABEL]: finalScore100,
    [BRIEF_AI_SUMMARY_FIELD_LABEL]: brief,
    [REMARKS_OC_LOG_FIELD_LABEL]: remarksOc,

    "Time Spent Per User": timeSpent?.perUserText || "",
    "Time Spent Per Role": timeSpent?.perRoleText || "",
  };

  // ✅ threads to API-name CF
  if (Number.isFinite(Number(threadCount))) {
    setField(customFields, CF_NUMBER_OF_THREADS, THREAD_COUNT_FIELD_LABEL, Number(threadCount));
  }

  // ✅ LLM raw fields to API-name CF
  const llmCat = (aiResult?.llm_category || "").trim();
  const llmSub = (aiResult?.llm_subcategory || "").trim();
  if (llmCat) setField(customFields, CF_LLM_CATEGORY, LLM_CATEGORY_FIELD_LABEL, llmCat);
  if (llmSub) setField(customFields, CF_LLM_SUBCATEGORY, LLM_SUBCATEGORY_FIELD_LABEL, llmSub);

  const body = { customFields };
  console.log("Desk update payload:", JSON.stringify(body).slice(0, 1800));

  const result = await deskPatchTicket(ticketId, body);
  console.log("Desk update response:", result.status, JSON.stringify(result.data).slice(0, 1200));
  return result;
}

/**
 * =========================
 * Health check
 * =========================
 */
app.get("/", (_req, res) => res.send("✅ Railway app is live!"));

/**
 * =========================
 * Webhook
 * =========================
 */
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

      ticket_created_time = "",
      ticket_closed_time = "",
      ticket_owner = "",

      createdTime = "",
      closedTime = "",
      currentOwnerName = "",
      currentOwnerRole = "",
    } = body;

    createdTime = createdTime || ticket_created_time || "";
    closedTime = closedTime || ticket_closed_time || "";
    currentOwnerName = currentOwnerName || ticket_owner || "";

    // Fetch Desk ticket (source of truth)
    let deskTicket = null;
    if (ticket_id) {
      try {
        deskTicket = await deskGetTicket(ticket_id);
      } catch (e) {
        console.warn("Could not fetch ticket details:", e?.message || e);
      }
    }

    if (deskTicket && typeof deskTicket === "object") {
      createdTime = createdTime || deskTicket?.createdTime || "";
      closedTime = closedTime || deskTicket?.closedTime || "";
      channel = channel || deskTicket?.channel || channel;
      status = status || deskTicket?.status || status;
      priority = priority || deskTicket?.priority || priority;
      department = department || deskTicket?.departmentId || department;

      const assignee = deskTicket?.assignee || deskTicket?.owner || {};
      currentOwnerName = currentOwnerName || assignee?.name || assignee?.email || "";
      currentOwnerRole = currentOwnerRole || assignee?.roleName || assignee?.role || "Agent";
    }

    // Thread count (authoritative)
    const threadCount = getThreadCountFromDeskTicket(deskTicket);

    // ✅ Always update thread count
    if (ticket_id && Number.isFinite(threadCount)) {
      await updateThreadCountOnly(ticket_id, threadCount);
    }

    // Owner Change Log autofill if empty
    const ownerLogEmpty = !owner_change_log || !String(owner_change_log).trim();
    if (ownerLogEmpty && ticket_id) {
      const ownerLogText = buildOwnerLogWhenEmpty({ currentOwnerName, currentOwnerRole });
      if (ownerLogText) {
        await updateOwnerChangeLogOnly(ticket_id, ownerLogText);
        owner_change_log = ownerLogText;
      }
    }

    // Compute time spent
    const timeSpent = calculateTimeSpentPerUserAndRole({
      ownerChangeLog: owner_change_log,
      createdTime,
      closedTime,
      fallbackOwnerName: currentOwnerName,
      fallbackOwnerRole: currentOwnerRole,
    });

    // If <= 1 thread, skip AI scoring (but threads already updated)
    if (Number.isFinite(threadCount) && threadCount <= 1) {
      return res.json({ ok: true, skipped: true, reason: "threadCount<=1", threadCount, timeSpent });
    }

    // Call AI
    const prompt = PROMPT({
      subject,
      status,
      priority,
      channel,
      department,
      conversation,
      createdTime,
      closedTime,
      currentOwnerName,
      currentOwnerRole,
    });

    const ai = await callOpenAI(prompt);

    // Normalize scores + compute final score server-side
    ai.scores = normalizeScores(ai?.scores);
    ai.final_score = computeFinalScore100(ai.scores);

    // Write back to Desk (includes threads + llm fields)
    const deskResult = ticket_id
      ? await updateDeskTicket(ticket_id, { aiResult: ai, threadCount, timeSpent })
      : { skipped: true };

    return res.json({ ok: true, threadCount, ai, timeSpent, desk: deskResult });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on port", PORT));
