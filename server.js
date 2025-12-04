// server.js
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "2mb" }));

// ------------ ENV VARS ------------
const DESK_SHARED_SECRET = process.env.DESK_SHARED_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

// Use either a pre-generated access token (short-lived) OR refresh flow (recommended)
let ZOHO_OAUTH_TOKEN = process.env.ZOHO_OAUTH_TOKEN;

// Refresh flow vars (recommended)
const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const ZOHO_ACCOUNTS_DOMAIN =
  process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";

// If Zoho numeric fields reject null, set NA_NUMERIC_STRATEGY=zero
const NA_NUMERIC_STRATEGY = (process.env.NA_NUMERIC_STRATEGY || "null").toLowerCase(); // "null" | "zero"

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
You are an AI Ticket Audit Assistant. Analyze this Zoho Desk ticket for agent performance using ONLY the provided ticket data.

You MUST evaluate applicability first:
- Determine if ticket is "single-thread/single-touch" (minimal back-and-forth).
- If single-touch AND no follow-up was needed, Follow-up metric is NOT applicable.
- If single-touch AND no handoffs/gaps exist, No Drops metric is NOT applicable.

Rubric (score 1–5 integers):
1) FOLLOW-UP FREQUENCY
1 No follow-up; customer waited >48h
2 Late follow-up; customer chased
3 Follow-ups but sometimes delayed
4 Timely follow-ups; small delays
5 Proactive; consistent; timely

2) NO DROPS
1 Dropped/unassigned long
2 Ownership gaps; stalled
3 Minor stalls; recovered
4 Smooth; tiny gaps
5 Perfect continuity

3) SLA ADHERENCE (business hours aware; use timestamps if present; otherwise score 3 and say timestamps insufficient)
1 First response >4h OR resolution >24h
2 First response >1h AND resolution >6h
3 First response 30–60m OR resolution 4–6h OR timestamps unclear
4 First response <30m, resolution slightly late
5 Both within SLA comfortably

4) RESOLUTION QUALITY
1 Incorrect/unhelpful
2 Partially correct, unclear
3 Correct, missing clarity
4 Clear and complete
5 Exceptional clarity + proactive

5) CUSTOMER SENTIMENT
1 Very negative/escalated
2 Negative/frustrated
3 Neutral/unclear
4 Positive/cooperative
5 Very appreciative

6) AGENT TONE
1 Rude/unprofessional
2 Mechanical/not empathetic
3 Neutral/correct
4 Warm/polite
5 Highly empathetic/personalized

Final Score 1–100:
weights: Follow-up 15, No Drops 15, SLA 20, Resolution 20, Sentiment 15, Tone 15
If a metric is NOT applicable, EXCLUDE it and RENORMALIZE remaining weights to sum 100.
Convert 1–5 to percent: ((score-1)/4)*100.
final_score = round(sum(percent_i * weight_i))

CATEGORY/SUBCATEGORY (STRICT):
Use ONLY exact labels from Reference List (Category -> Subcategory -> Issue Summary).
Do not invent names.

REFERENCE LIST:
${REFERENCE_LIST}

Owner Change Log:
- Use timestamps only to compute time per owner/role; round nearest 0.5h.
- If empty/missing: current owner held full duration (closedTime-createdTime else now-createdTime).

Ticket timestamps (may be missing):
createdTime: ${createdTime || "(missing)"}
closedTime: ${closedTime || "(missing)"}
currentOwnerName: ${currentOwnerName || "(missing)"}
currentOwnerRole: ${currentOwnerRole || "(missing)"}

Return JSON ONLY, matching this schema:
{
  "title": "Ticket Follow-up Analysis",
  "follow_up_status": "Follow-up Completed|Delayed Follow-up|Missed Follow-up|No Commitment Found",
  "category": "...",
  "subcategory": "...",
  "issue_summary": "...",
  "applicability": { "follow_up_frequency": true, "no_drops": true },
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
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
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
  ZOHO_OAUTH_TOKEN = data.access_token;
  return ZOHO_OAUTH_TOKEN;
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
function computeFinalScoreDynamic(scores = {}, applicability = {}) {
  const base = [
    ["follow_up_frequency", 15, applicability.follow_up_frequency !== false],
    ["no_drops", 15, applicability.no_drops !== false],
    ["sla_adherence", 20, true],
    ["resolution_quality", 20, true],
    ["customer_sentiment", 15, true],
    ["agent_tone", 15, true],
  ];

  const kept = base
    .map(([k, w, app]) => ({ k, w, app, pct: scoreToPct(scores[k]) }))
    .filter((x) => x.app && x.pct !== null);

  if (!kept.length) return 0;

  const wsum = kept.reduce((a, x) => a + x.w, 0);
  const final = kept.reduce((a, x) => a + x.pct * (x.w / wsum), 0);
  return Math.round(final);
}

function zohoNumericNA(v) {
  // If Zoho numeric custom fields reject null, use 0 instead.
  if (v !== null && v !== undefined) return v;
  return NA_NUMERIC_STRATEGY === "zero" ? 0 : null;
}

// ------------ Update Zoho Desk ticket ------------
async function updateDeskTicket(ticketId, aiResult) {
  if (!ZOHO_ORG_ID) {
    console.warn("ZOHO_ORG_ID missing; skipping Desk update.");
    return { skipped: true };
  }

  const applicability = aiResult.applicability || {};
  const scores = aiResult.scores || {};
  const scoreReasons = aiResult.score_reasons || {};

  const normalizedScores = {
    follow_up_frequency: clampScore15(scores.follow_up_frequency),
    no_drops: clampScore15(scores.no_drops),
    sla_adherence: clampScore15(scores.sla_adherence) ?? 3,
    resolution_quality: clampScore15(scores.resolution_quality) ?? 3,
    customer_sentiment: clampScore15(scores.customer_sentiment) ?? 3,
    agent_tone: clampScore15(scores.agent_tone) ?? 3,
  };

  // hard enforce N/A behavior if applicability says false
  if (applicability.follow_up_frequency === false) {
    normalizedScores.follow_up_frequency = null;
    scoreReasons.follow_up_frequency =
      scoreReasons.follow_up_frequency ||
      "Not applicable (single-thread ticket; no follow-up required).";
  }
  if (applicability.no_drops === false) {
    normalizedScores.no_drops = null;
    scoreReasons.no_drops =
      scoreReasons.no_drops ||
      "Not applicable (single-touch ticket; no handoffs/gaps to evaluate).";
  }

  const followUpStatus = normalizeFollowUpStatus(aiResult.follow_up_status);
  const ownerTimeRemark = aiResult.owner_time_summary || "";
  const aiMainSummary = aiResult.reasons || "";
  const timeSpentPerUser = aiResult.time_spent_per_user || "";
  const timeSpentPerRole = aiResult.time_spent_per_role || "";
  const issueSummary = aiResult.issue_summary || "";

  const finalScore100 = computeFinalScoreDynamic(normalizedScores, applicability);

  const customFields = {
    "Follow-up Status": followUpStatus,
    "AI Category": aiResult.category || "",
    "AI Sub Category": aiResult.subcategory || "",
    "AI Final Score": finalScore100,
    "AI Category explanation": aiMainSummary,

    "Follow-Up Frequency": zohoNumericNA(normalizedScores.follow_up_frequency),
    "No Drops Score": zohoNumericNA(normalizedScores.no_drops),
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
    "Time Spent Per User": timeSpentPerUser,
    "Time Spent Per Role": timeSpentPerRole,
    "Issue Summary": issueSummary,
  };

  const body = { customFields };

  // Try once with current token; if INVALID_OAUTH, refresh and retry once
  async function patchWithToken(token) {
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

  if (!ZOHO_OAUTH_TOKEN) {
    await refreshZohoAccessTokenIfPossible();
  }
  if (!ZOHO_OAUTH_TOKEN) {
    console.warn("No Zoho access token available; skipping Desk update.");
    return { skipped: true };
  }

  console.log("Desk update payload:", JSON.stringify(body).slice(0, 900));

  let { r, data } = await patchWithToken(ZOHO_OAUTH_TOKEN);

  if (r.status === 401 && (data?.errorCode === "INVALID_OAUTH" || `${data?.message || ""}`.includes("invalid"))) {
    console.warn("Zoho token invalid; refreshing and retrying once...");
    const newTok = await refreshZohoAccessTokenIfPossible();
    if (newTok) ({ r, data } = await patchWithToken(newTok));
  }

  console.log("Desk update response:", r.status, JSON.stringify(data).slice(0, 1200));
  return { status: r.status, data };
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

      // OPTIONAL: send these if you can
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

    // Compute final score server-side (guarantees N/A exclusion math)
    ai.final_score = computeFinalScoreDynamic(ai.scores || {}, ai.applicability || {});

    let deskResult = { skipped: true };
    if (ticket_id) deskResult = await updateDeskTicket(ticket_id, ai);
    else console.warn("No ticket_id in payload; skipping Desk update.");

    return res.json({ ok: true, ai, desk: deskResult });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Unknown error" });
  }
});

// ------------ Start server ------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Server running on port", PORT));
