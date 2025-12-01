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
- Mapping: Online scheduling mapping mismatch with EHR.
- Configuration: Online scheduling configuration needed or incorrect.
- Appointment Write problem into EHR: Appointment write-back toggle off or failing.
- Wrong Appointment Time: Wrong time booked vs EHR schedule.
- Slot Missing: Schedule slots missing vs EHR.
- Slot Available on Block / Holiday: Blocked/holiday slots still available.
- Provider Hours Missing: Provider hours not configured or missing.
- Operatory Hours Missing: Operatory hours not set correctly.
- Business Hours Missing: Business hours mismatch between EHR and Adit.
- Incorrect Slots Appear: Slots not blocked or reflecting EHR config.
- Forms Configuration Issue: Webforms not configured for OS microsite.

Category: Engage Issue
- Appointment Reminder Isn't Received: Patient not receiving reminders.
- Appointment Reminder Setup Issue: Reminder workflows not configured.
- Appointment Reminder With Incorrect Time: Reminder time wrong or out of sync.
- Appointment Reminder Delay: Reminder sent late vs schedule.
- SC Isn't Received: Schedule confirmation not sent.
- SC Issue for New & Existing Patient: SC flow not correct per patient type.
- SC Issue With Patient Forms: Forms missing in SC workflow.
- AR Cron Issue: Reminder CRON not running.
- SC Cron Issue: Schedule confirmation CRON not running.
- BR Sent to Inactive Patients: Birthday reminders sent to inactive records.
- BR Sent to Wrong Patient: Birthday reminder mapped to wrong patient.
- BR Not Sent: Birthday reminders not triggered.
- Recall Reminder Not Sent: Recall reminders not going out.
- Recall Reminder to Inactive Patient: Recall going to inactive patient.
- Recall Sent to Wrong Patient: Recall mapped to wrong patient.
- Recall Not Sent Despite Appointment: Appointment exists but no recall.
- Recall Types Issue: Recall types/toggles missing or off.
- Recall Due Date Issue: Incorrect recall due date.
- Payment Reminder Issue: Payment reminders not sending.
- Missed Call Text Issue: Missed-call text not going due to config/hours.
- Auto Confirmation Issue: Auto-confirmation not updating status.
- Appointment Write Issue: Appointment not written from OS to schedule.
- Multiple Appointment Confirmed Issue: Multiple confirmations not handled correctly.
- Auto Confirm Thank You Issue: Wrong auto “thank you” message.
- Status Mapping Issue: Status mapping incorrect between systems.
- Auto Confirmation Mapping Issue: EHR not updating after Adit confirm.
- Auto Confirmation Reply Issue: Auto confirmation reply not going.
- Chat Thread Not Updated: Chat not syncing between Adit and EHR.
- Wrong Chat Populate: Wrong chat mapping or delayed sync.
- Chat Thread Missing: Chat thread missing in UI.

Category: Patient Form Issue
- Patient Form Not Sending: Form not sent due to wrong email/phone.
- Patient Form Not Received: Form not received in Adit/EHR.
- Form Details Not Auto-Populating: Patient data not autofilling.
- Mapping Issue: PMS field mapping incorrect.
- Allergies/Problem/Medication Not Syncing: A/P/M not imported from EHR.
- Allergies/Problem/Medication Write-back Issue: A/P/M write-back failing.
- Medical History Questions Not Syncing: Medical history questions not synced.
- Medical History Write-back Issue: Medical history write-back failing.
- Allergies/Problem/Medication Missing: A/P/M data missing from EHR.
- Signature Issue: Signature not captured or displayed.
- Multi-Sign Issue: Multiple signatures not configured.
- Patient Form Importing Issue: Form import sync failure.
- Patient Form Missing After Submission: Submitted form not visible.
- Device Connection Issue: Kiosk/tablet device disconnected or outdated.
- Field Dependency Issue: Dependent fields/logic broken.
- PDF Sync Issue: PDF not generated or synced.
- PDF Not Opening in EHR: PDF not viewable in EHR.
- Auto Import Issue: Auto-import toggle off or wrong link used.
- New Patient Updated Into Existing Patient: New form linked to wrong existing chart.
- Existing Patient Updated With New Patient Details: Existing chart overwritten incorrectly.
- PDF Layout Issue: PDF layout or formatting incorrect.
- Patient Form Auto Assign Issue: Auto-assign/auto-approve not working.

Category: Patient Card
- Patient Details Missing: Patient info not visible.
- Patient Logs Missing: Activity logs missing.
- Follow-Up Logs Missing: Follow-up records missing.
- Wrong Last/Next/Due Date: Last/next/due dates incorrect.
- Image Missing: Patient photo not loading.
- Patient Form Search Issue: Forms not found in search.

Category: Pozative Issue
- Review Request Not Sent: Review requests not sent.
- Frequency Issue: Review request frequency wrong.
- Business URL Missing: GMB/Business URL not configured.
- Business Page Disconnection: Google business page disconnected.
- Feedback Issue: Feedback missing in portal.
- Reviews Not Syncing: Reviews not syncing from sources.

Category: Email Issue
- Email Bounce Back: Email bouncing due to DNS/TXT issues.
- Email Sending Issue: Emails not sending.
- Email Attachment Issue: Attachments not uploading/downloading.
- Email Tags Issue: Email tags not applied.
- Email Reporting Issue: Email metrics/reporting incorrect.
- Unsubscribe Issue: Unsubscribe not working.

Category: Desktop Phones
- Phone not ringing when receiving calls: No ring on inbound calls.
- Unable to make outbound calls: Outbound calls failing.
- Account not registered / logged out: SIP not registered / logged out.
- Keys not responding or malfunctioning: Buttons not working.
- Phone not powering on / random shutdowns: Power or reboot issues.
- Call park not working: Call park feature failing.
- Firmware not updating or stuck update: Firmware update stuck.
- Receiver not working / no audio: No audio in receiver.
- Faulty handset or LAN ports: Hardware or port fault.
- LAN cable damaged / loose: LAN cable or connection issue.
- Bluetooth headset not connecting: Bluetooth pairing issue.

Category: Cordless Phones
- Phone not ringing when receiving calls: Cordless not ringing.
- Unable to make outbound calls: Cordless outbound failing.
- Account not registered / logged out: Cordless SIP not registered.
- Phone goes out of range: Handset losing range.
- Base station offline or disconnected: Base station offline.
- Keys not responding or malfunctioning: Handset keys not working.
- Phone not powering on / random shutdowns: Power/battery issues.
- Call park not working: Call park not working on cordless.
- Firmware not updating or stuck update: Cordless firmware stuck.
- Receiver not working / no audio: No audio on cordless.
- Faulty handset or LAN ports: Faulty handset/base ports.
- LAN cable damaged / loose: LAN issues on base.
- Bluetooth headset not connecting: Bluetooth not pairing.

Category: Software
- Notifications not working: Call/message notifications not firing.
- Voicemail not working / setup issues: Voicemail access/config issues.
- Softphone not working on Desktop: Desktop softphone not registering or calling.
- Softphone not working on Android: Android softphone failing.
- Softphone not working on iOS: iOS softphone failing or crashing.
- Call park not working on app: Call park broken in app.
- Number assignment errors: Wrong/missing number assignment.
- Voicemail access errors: Errors accessing voicemail.
- Update or change label/name: Label/name change request.
- Wrong practice timezone configuration: Timezone configured incorrectly.
- Call flow errors: Call flow route errors.

Category: Product / Carrier Issues
- Need isolation testing: Need isolation tests to find cause.
- Whitelisting pending/not done: IP/port whitelisting incomplete.
- Device-specific problems: Issue limited to certain device/model.
- Server-related issues: Server-side config/outage problem.
- Carrier issue with Plivo: Plivo carrier problem.
- Carrier issue with Telnyx: Telnyx carrier problem.
- Porting not completed / failed: Number port stuck or failed.
- Wrong or broken network configuration: Network/VLAN/DNS misconfig.
- Receiver failure (audio issues): Audio output failure.
- Unable to send or open attachments: Attachments failing in comms.

Category: Audio Quality – Inbound
- Internet speed too low: Inbound audio poor due to low bandwidth.
- High call latency / delay: Inbound audio delay.
- Call fluctuations / instability: Inbound audio fluctuating.
- One-way audio (hear only one side): One-way inbound audio.
- Crackling/static noise: Noisy inbound audio.
- Whitelisting required: Inbound audio fixed by whitelisting.
- Client expectation not met: Inbound audio below expectations.

Category: Audio Quality – Outbound
- Internet speed too low: Outbound audio poor due to low upload.
- High call latency / delay: Outbound audio delayed.
- Call fluctuations / instability: Outbound audio cutting or unstable.
- One-way audio (hear only one side): One-way outbound audio.
- Crackling/static noise: Noisy outbound audio.
- Whitelisting required: Outbound audio needs whitelisting.
- Client expectation not met: Outbound audio below expectations.

Category: Audio Quality – Both Directions
- Internet speed too low: Low bandwidth affecting both sides.
- High call latency / delay: Two-way audio lag.
- Call fluctuations / instability: Two-way instability.
- One-way audio (hear only one side): Persistent one-way issues.
- Crackling/static noise: Static in both directions.
- Whitelisting required: Two-way audio fixed by whitelisting.
- Client expectation not met: Two-way quality below expectations.

Category: Caller Name / ID
- Receiving spam calls: High spam/robocall volume.
- Wrong caller name displayed: Caller name shown wrong.
- Caller ID mismatch: Caller ID not matching number.
- Need to update label name: Caller ID label change request.

Category: General Enquiries
- Request for product information: Questions on product/features.
- Asking for a new feature: New feature request.
- Questions on managing users: User management questions.
- Questions on managing permissions: Permission/access questions.
- Client expectation queries: Clarification on expectations.

Category: Custom Fix
- Enable/disable hold reminder tone: Hold reminder tone change.
- Adjust timezone settings: Timezone correction request.
- Change call waiting tone: Change call waiting tone.
- Error during upgrade (timeout): Upgrade timeout issue.
- Setup speed dials: Speed dial setup help.
- Add more call park lines: More call park lines requested.
- Provide a feature-specific workaround: Temporary feature workaround.

Category: Bugs & Defects
- Mobile app crashing: Mobile app crash.
- Desktop app crashing: Desktop app crash/freeze.
- Softphone bugs: Softphone bug behavior.
- Firmware-related bugs: Firmware-level defect.
- Notifications not working: Notification bug.
- Unable to answer or hang up calls: Call answer/hangup not working.
- Hardware defect: Physical device defect.
- Voicemail issues: Voicemail-related bug.
- Hold music not working: Hold music failure.
- Audio library not working: Audio library issues.
- Software glitches: UI/logic glitches.
- Call tracking not working: Call tracking module failing.
- Call flow not working: Call flow not executing.
- Call override not working: Override not applying.

Category: Call Drop
- Network issues causing call drop: Drops due to network.
- Firmware bug causing call drop: Drops due to firmware bug.
- Whitelisting pending/not done: Drops due to missing whitelisting.

Category: Installations
- New phone installation: New phones install/setup.
- Replacement phone install: Replacement phone install.
- Partial phone installation: Incomplete install.
- V3 migration setup: Migration to V3 setup.
- Bluetooth headset installation: Bluetooth headset pairing/setup.

Category: Training
- Call Flow Training: Training on call flow/IVR.
- Phone feature training: Phone feature training.
- Desktop app training: Desktop app training.
- Mobile app training: Mobile app training.
- Call override training: Call override training.
- eFax training: eFax usage training.
- Block caller: How to block callers.
- Hold music: How to set hold music.
- Audio library: Managing audio library.
- Multilocation call transfer: Multi-location transfer config.
- Conference call setup: Conference call setup training.
- Enable patient card: How to enable patient card.
- Enable call pop up: How to enable call pop-ups.
- Call tracking: Call tracking configuration training.
- E911 Setup: E911 setup guidance.
- Multiple Voicemail Box: Multiple voicemail box setup.

Category: Mass Texting
- Not able to stop mass text: Cannot stop mass text in progress.
- Not able to select segment in mass text: Cannot select segment when building campaign.

Category: ASAP
- Wrong patient appear in ASAP: Wrong patients listed in ASAP.
- No patient in ASAP list: ASAP list empty; manual selection needed.

Category: Internal Chat
- Messages not received: Internal chat messages not received.
- Not able to delete chat: Cannot delete chat messages.
- Message delay: Chat messages delayed.

Category: Others
- Notification Missing: Notifications not showing.
- Notification read issue: Notifications not opening.
- Notification not redirecting: Notification link not redirecting.
- Dual notification issue: Duplicate notifications.
- App Lag Issue: Desktop app lagging.
- Server disconnection: Disconnect when server off.
- EHR Sync break: EHR sync broken.
- Frequent Disconnect: Frequent network/service drops.
- Adit app slow in web: Web app slow; cache/cookies needed.
- Adit app slow in desktop app: Desktop app slow.
- Status mapping issue: Status mapping incorrect.
- Wrong business hours: Business hours misconfigured.

Category: Server App
- EHR/PMS Disconnected Error on Adit app: EHR/PMS disconnected.
- Patient forms are not syncing: Forms not syncing via server app.
- Reminders not going out: Reminders blocked by server app issue.
- Payments not syncing: Adit Pay payments not syncing.
- EHR disconnected: EHR fully disconnected.
- Practice Analytics not syncing: PA not syncing.
- Server app resync: Server app needs resync.
- Server app reinstall: Server app reinstall needed.
- Server app install: Initial server app install.
- EHR change: EHR/PMS change needed.
- EHR disconnection frequently: Frequent EHR disconnects.
- Server system changed: Server system change causing issues.
- High CPU usage: High CPU use on server.
- EHR Crashing: EHR app crashing.
- Server Crashing: Server crashes.
- EHR upgrade: EHR upgrade required.
- Server App upgrade: Server app upgrade needed.
- Cloud EHR install: Cloud EHR install required.
- Chrome Extension not working: Chrome extension not working.
- Chrome Extension installation: Chrome extension install help.

Category: Adit Pay
- Ledger Posting: Payments not posting to ledger.
- Payment Issue: General payment sync issue.
- Terminal Issues: Card terminal malfunction.
- Hardware Replacement/Return: Pay hardware RMA.
- Demo/Basic Inquiry: Info/demo request for Adit Pay.
- Walkthrough Training: Adit Pay training.
- Sign Up/Set Up: Adit Pay onboarding/setup.
- Terminal Registration: Terminal registration needed.
- Price Comparison: Compare Adit Pay pricing.
- Feature Request: Adit Pay feature request.
- Bugs/Outage: Adit Pay bugs/outage.
- Configuration/Settings: Adit Pay config issue.
- Basic Troubleshooting: Basic Pay troubleshooting.
- EHR Disconnection: Adit Pay disconnected via server app.
- Payment Failure: Payment cannot be completed.
- Payout Delay: Payout delayed.
- Refund Not Reflecting: Refund not visible.

Category: Practice Analytics
- Sync: PA data not syncing/loading.
- Data issues: PA data inaccurate.
- Preferences: Issues with goals/follow-ups/team prefs.
- Training: PA training required.
- Upgrade to Analytics: Upgrade to Analytics bundle.
- Feature Requests: PA feature requests.
- Patient list Requests: Help with patient lists.
- Export: Export errors from PA.
- Daily, Weekly, Monthly Reports: Report filters/view not working.

Category: Chat Issue
- Chats not working: Live chat widget not opening.
- Chats Deleted: Chats auto-deleting.
- Chats not syncing: Chat not syncing across devices.

Category: Bulk Issue
- Bulk Upload / Import issue: Bulk import/upload failing.
- Bulk SMS Issue: Bulk SMS not sending.
- Bulk Email Issue: Bulk email failing.

Category: Form Issue
- Form not loading: Forms not loading.
- Form Submission Issue: Form submit failing.
- Mapping Issue: Form data mapping incorrect.

Category: Review Issue
- Reviews not coming: Reviews not syncing in.
- Review link not working: Review link broken.

Category: Billing Issue
- Invoice Issue: Invoice incorrect/not generating.
- Refund Request: Refund request on transaction.

Category: Campaign Issue
- Campaign not working: Campaigns not sending.
- Tracking Issue: Campaign tracking inaccurate.

Category: Call Tracking Issue
- Number not working: Tracking number not receiving calls.
- Call Forwarding Issue: Forwarding not working or wrong.

Category: Permission Issue
- User Role Issue: Wrong role/permission for user.
- Access Denied: User access denied to area.

Category: Telemed Issue
- Video Not Working: Telemed video failing.
- Audio Not Working: Telemed audio failing.
- Link Not Working: Telemed link invalid or expired.

Category: Patient Sync Issue
- Patient not syncing: Patient not synced into Adit.
- Duplicate Patient: Duplicate patient records.

Category: Analytics Issue
- Report Wrong: Analytics numbers incorrect.
- Dashboard not loading: Dashboard not loading data.

Category: Appointment Issue
- Unable to book appointment: Booking throws error or fails.
- Appointment not syncing: Appointment not showing in Adit/EHR.

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

IMPORTANT RULES FOR OWNER CHANGE LOG:
- Use the Owner Change Log timestamps to calculate time spent per user and per role.
- Never guess the time. Only calculate from the timestamps provided.

IMPORTANT RULE — WHEN OWNER CHANGE LOG IS EMPTY:
    • If the Owner Change Log is null, empty, or missing:
         - The ticket stayed with the current owner for the FULL duration.
         - The AI MUST CALCULATE that full duration using the  logic .
               Example:
                    full_duration = closedTime - createdTime
                    OR
                    full_duration = now() - createdTime
         - Use the actual current owner name from ticket details.
         - Use the actual current owner role (from Department or metadata).

    • Return EXACTLY:
          "time_spent_per_user": "<Current Owner Name> – <calculated full duration in hours>",
          "time_spent_per_role": "<Current Owner Role> – <calculated full duration in hours>"

ADDITIONAL RULES:
    • Always round duration to nearest 0.5 hr.
    • Do not include customers or external users in this calculation.
    • Ignore system updates that do not change ownership.
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

3. SCORING (0–5 each, integers):
- Follow-Up Frequency
- No Drops
- SLA Adherence
- Resolution Quality
- Customer Sentiment (0–5, treat -10..+10 notes as 0..10)
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
