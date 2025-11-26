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
- Mapping: Online scheduling not mapped correctly between provider, operatory, and services with EHR.
- Configuration: Online scheduling configuration requires setup.
- Appointment Write problem into EHR: Appointment write-back toggle turned off.
- Wrong Appointment Time: Incorrect schedule time mapped when booking appointments.
- Slot Missing: Appointment and schedule slots mismatch with EHR.
- Slot Available on Block / Holiday: Blocked or holiday slots appearing as available.
- Provider Hours Missing: Provider hours missing on schedule.
- Operatory Hours Missing: Operatory open hours missing or incorrect.
- Business Hours Missing: Business hours mismatch between EHR and Adit.
- Incorrect Slots Appear: Slots not blocked correctly per EHR data.
- Forms Configuration Issue: Webforms not configured correctly for online scheduling via microsite link.

Category: Engage Issue
- Appointment Reminder Isn't Received: Patients not receiving appointment reminders.
- Appointment Reminder Setup Issue: Appointment reminders not configured correctly.
- Appointment Reminder With Incorrect Time: Reminder time incorrect due to server/app disconnect or reschedule.
- Appointment Reminder Delay: Reminders delayed beyond configured schedule.
- SC Isn't Received: Schedule confirmation toggle off or advanced filters applied.
- SC Issue for New & Existing Patient: SC flow not configured correctly for different patient types.
- SC Issue With Patient Forms: Patient forms not added to SC workflow.
- AR Cron Issue: Appointment reminder CRON service malfunction.
- SC Cron Issue: Schedule confirmation CRON malfunction.
- BR Sent to Inactive Patients: Birthday reminders sent to inactive patients.
- BR Sent to Wrong Patient: Incorrect patient receiving birthday reminders.
- BR Not Sent: Birthday reminders not triggering.
- Recall Reminder Not Sent: Recall reminders failing based on recall type or setup.
- Recall Reminder to Inactive Patient: Recall sent to inactive patient.
- Recall Sent to Wrong Patient: Incorrect patient mapping.
- Recall Not Sent Despite Appointment: Appointment exists but recall not sent.
- Recall Types Issue: Recall types missing or toggles off.
- Recall Due Date Issue: Incorrect due date selected.
- Payment Reminder Issue: Payment reminders not sending.
- Missed Call Text Issue: Missed-call text not sent due to setup or missing business hours.
- Auto Confirmation Issue: Auto-confirmation not updating correctly.
- Appointment Write Issue: Appointment not added to schedule from Adit OS.
- Multiple Appointment Confirmed Issue: Multiple confirmations not updating properly.
- Auto Confirm Thank You Issue: Incorrect auto-reply message sent.
- Status Mapping Issue: Appointment status mapping incorrect.
- Auto Confirmation Mapping Issue: EHR not confirming after Adit confirmation.
- Auto Confirmation Reply Issue: Auto-confirmation replies not sent.
- Chat Thread Not Updated: Chat thread not syncing between Adit and EHR.
- Wrong Chat Populate: Incorrect chat mapping or delayed sync.
- Chat Thread Missing: Messages missing or not showing.

Category: Patient Form Issue
- Patient Form Not Sending: Incorrect patient email/phone.
- Patient Form Not Received: Form not received in Adit or EHR.
- Form Details Not Auto-Populating: Patient data not auto-filling.
- Mapping Issue: PMS mapping incorrect.
- Allergies/Problem/Medication Not Syncing: Questions not imported from EHR.
- Allergies/Problem/Medication Write-back Issue: Write-back mapping incomplete.
- Medical History Questions Not Syncing: Mismatch between Adit and EHR.
- Medical History Write-back Issue: Mapping issue prevents update.
- Allergies/Problem/Medication Missing: Missing or incomplete EHR data.
- Signature Issue: Signature not displaying.
- Multi-Sign Issue: Multiple signatures not configured.
- Patient Form Importing Issue: Sync failure or wrong folder mapping.
- Patient Form Missing After Submission: Form not visible after submission.
- Device Connection Issue: Device disconnected or app outdated.
- Field Dependency Issue: Conditional form logic broken.
- PDF Sync Issue: PDF not created or not updated.
- PDF Not Opening in EHR: PDF import issue into EHR.
- Auto Import Issue: Auto-import toggle off or wrong link sent.
- New Patient Updated Into Existing Patient: Wrong patient chart linked.
- Existing Patient Updated With New Patient Details: Incorrect mapping during import.
- PDF Layout Issue: Incorrect PDF layout rendering.
- Patient Form Auto Assign Issue: Auto-approval toggle off.

Category: Patient Card
- Patient Details Missing: Patient metadata missing.
- Patient Logs Missing: Activity logs missing.
- Follow-Up Logs Missing: Follow-up logs not syncing.
- Wrong Last/Next/Due Date: Dates incorrect due to EHR sync issue.
- Image Missing: Patient photo upload failed.
- Patient Form Search Issue: Form search not retrieving records.

Category: Pozative Issue
- Review Request Not Sent: Review request messages not sent.
- Frequency Issue: Wrong review request frequency setup.
- Business URL Missing: GMB URL not configured.
- Business Page Disconnection: Google business page disconnected.
- Feedback Issue: Feedback not appearing in portal.
- Reviews Not Syncing: Reviews not syncing from Google/Facebook.

Category: Email Issue
- Email Bounce Back: TXT/DNS not verified.
- Email Sending Issue: Incorrect email address or sending failure.
- Email Attachment Issue: Attachments failing to upload.
- Email Tags Issue: Tags not applying.
- Email Reporting Issue: Reporting metrics not showing correctly.
- Unsubscribe Issue: Unable to unsubscribe from email list.

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

Category: Software
Software	Notifications not working	Desktop or mobile notifications not triggering for incoming calls or messages.
Software	Voicemail not working / setup issues	Users unable to access or configure voicemail settings correctly.
Software	Softphone not working on Desktop	Desktop app softphone fails to connect or make calls.
Software	Softphone not working on Android	Android softphone app fails to register or handle calls.
Software	Softphone not working on iOS	iOS softphone app not registering or crashing during use.
Software	Call park not working on app	Call park functionality unavailable or broken in mobile/desktop app.
Software	Number assignment errors	Wrong or missing number assignment in the system or app.
Software	Voicemail access errors	Errors while retrieving or accessing voicemail through app or portal.
Software	Update or change label/name	Request to modify displayed name or label on app or device.
Software	Wrong practice timezone configuration	Practice time zone configured incorrectly in portal settings.
Software	Call flow errors	Incorrect or broken routing causing call flow failures.

Category: Product / Carrier Issues
Product / Carrier Issues	Need isolation testing	Require test calls or environment setup to isolate issue cause.
Product / Carrier Issues	Whitelisting pending/not done	IP or port whitelisting not completed, affecting connectivity.
Product / Carrier Issues	Device-specific problems	Issue isolated to a specific model or firmware version.
Product / Carrier Issues	Server-related issues	Problem originating from server-side configuration or outage.
Product / Carrier Issues	Carrier issue with Plivo	Carrier-side problem affecting call routing or delivery.
Product / Carrier Issues	Carrier issue with Telnyx	Telnyx carrier routing or call completion issue.
Product / Carrier Issues	Porting not completed / failed	Number port not yet completed or has failed validation.
Product / Carrier Issues	Wrong or broken network configuration	Incorrect VLAN, DNS, or IP settings causing service disruption.
Product / Carrier Issues	Receiver failure (audio issues)	Audio output failure due to hardware or network degradation.
Product / Carrier Issues	Unable to send or open attachments	Attachments fail to upload or download in ticket/email communication.

Category: Audio Quality – Inbound
Audio Quality – Inbound	Internet speed too low	Low bandwidth on client side causing degraded inbound audio.
Audio Quality – Inbound	High call latency / delay	Delay in receiving audio from caller side due to network lag.
Audio Quality – Inbound	Call fluctuations / instability	Inconsistent inbound audio caused by packet loss or jitter.
Audio Quality – Inbound	One-way audio (hear only one side)	Caller can hear but not be heard (or vice versa).
Audio Quality – Inbound	Crackling/static noise	Distorted inbound audio due to line interference or jitter.
Audio Quality – Inbound	Whitelisting required	Audio failure resolved by completing IP/port whitelisting.
Audio Quality – Inbound	Client expectation not met	Client perceives audio performance below acceptable quality.

Category: Audio Quality – Outbound
Audio Quality – Outbound	Internet speed too low	Low upload bandwidth causing distorted outbound audio.
Audio Quality – Outbound	High call latency / delay	Outgoing voice delayed due to high latency or routing path.
Audio Quality – Outbound	Call fluctuations / instability	Outbound audio breaking up or cutting off intermittently.
Audio Quality – Outbound	One-way audio (hear only one side)	Client cannot hear recipient; outbound RTP blocked.
Audio Quality – Outbound	Crackling/static noise	Outgoing audio distorted by jitter or device interference.
Audio Quality – Outbound	Whitelisting required	Whitelisting pending for stable outbound audio path.
Audio Quality – Outbound	Client expectation not met	Outbound audio clarity not matching client expectations.

Category: Audio Quality – Both Directions
Audio Quality – Both Directions	Internet speed too low	Bandwidth issues affecting both inbound and outbound streams.
Audio Quality – Both Directions	High call latency / delay	Audio lag present on both ends due to route delay.
Audio Quality – Both Directions	Call fluctuations / instability	Audio breaks or drops intermittently in both directions.
Audio Quality – Both Directions	One-way audio (hear only one side)	One-way audio persisting in both inbound/outbound tests.
Audio Quality – Both Directions	Crackling/static noise	Audio distorted or staticky across both channels.
Audio Quality – Both Directions	Whitelisting required	Two-way audio instability until IP/ports are whitelisted.
Audio Quality – Both Directions	Client expectation not met	Audio quality below client’s expected standard in both directions.

Category: Caller Name / ID
Caller Name / ID	Receiving spam calls	Frequent spam or robocalls received by the client.
Caller Name / ID	Wrong caller name displayed	Caller name shown incorrectly on inbound calls.
Caller Name / ID	Caller ID mismatch	Displayed caller ID differs from configured number.
Caller Name / ID	Need to update label name	Request to modify or correct caller ID label name.

Category: General Enquiries
General Enquiries	Request for product information	Client requesting details on existing product or feature.
General Enquiries	Asking for a new feature	Client suggesting or requesting new product functionality.
General Enquiries	Questions on managing users	Queries related to adding, removing, or modifying users.
General Enquiries	Questions on managing permissions	Clarification on access control or permission setup.
General Enquiries	Client expectation queries	Client concerns or expectations needing clarification.

Category: Custom Fix
Custom Fix	Enable/disable hold reminder tone	Request to enable or disable periodic hold tone reminders.
Custom Fix	Adjust timezone settings	Request to correct or modify practice time zone.
Custom Fix	Change call waiting tone	Customize or adjust call waiting alert tone.
Custom Fix	Error during upgrade (timeout)	System timeout error encountered during upgrade.
Custom Fix	Setup speed dials	Assistance with configuring speed dial buttons.
Custom Fix	Add more call park lines	Request to expand call park capacity.
Custom Fix	Provide a feature-specific workaround	Custom configuration to temporarily bypass an issue.

Category: Bugs & Defects
Bugs & Defects	Mobile app crashing	Mobile application closes unexpectedly during use.
Bugs & Defects	Desktop app crashing	Desktop app crashes or freezes during operation.
Bugs & Defects	Softphone bugs	Unexpected behavior or errors within the softphone feature.
Bugs & Defects	Firmware-related bugs	Device malfunctions due to firmware-related issues.
Bugs & Defects	Notifications not working	Notification system fails to alert users on calls or messages.
Bugs & Defects	Unable to answer or hang up calls	Call controls unresponsive on device or app.
Bugs & Defects	Hardware defect	Physical defect or malfunction in device hardware.
Bugs & Defects	Voicemail issues	Errors accessing, saving, or retrieving voicemail messages.
Bugs & Defects	Hold music not working	Hold music not playing for callers placed on hold.
Bugs & Defects	Audio library not working	Audio files in library fail to load or play.
Bugs & Defects	Software glitches	Minor UI or performance bugs affecting usability.
Bugs & Defects	Call tracking not working	System not logging or tracking calls correctly.
Bugs & Defects	Call flow not working	Configured call routing not functioning as expected.
Bugs & Defects	Call override not working	Override settings fail to take effect.

Category: Call Drop
Call Drop	Network issues causing call drop	Calls disconnect mid-way due to network interruptions.
Call Drop	Firmware bug causing call drop	Call termination triggered by firmware-level defect.
Call Drop	Whitelisting pending/not done	Call drops due to missing network whitelisting.

Category: Installations
Installations	New phone installation	Installation and setup of new phones at client site.
Installations	Replacement phone install	Replacement device installation for defective unit.
Installations	Partial phone installation	Incomplete setup requiring follow-up.
Installations	V3 migration setup	Migration setup from old to V3 platform.
Installations	Bluetooth headset installation	Assistance with pairing Bluetooth headset devices.



Category: Mass Texting
- Not able to stop mass text: Unable to stop a mass text once it has been initiated.
- Not able to select segment in mass text: Unable to add or select a segment while creating a mass text.

Category: ASAP
- Wrong patient appear in ASAP: Incorrect patients appearing due to manual selection errors.
- No patient in ASAP list: Patients not appearing; need to manually select from list.

Category: Internal Chat
- Messages not received: Internal messages not being received in Adit.
- Not able to delete chat: Unable to delete messages in internal chat.
- Message delay: Messages delayed or failing to send through internal chat.

Category: Others
- Notification Missing: Notifications not appearing on Adit dashboard.
- Notification read issue: Unable to open or read received notifications.
- Notification not redirecting: Notifications not redirecting to the correct page.
- Dual notification issue: Duplicate notifications appearing for the same message.
- App Lag Issue: Desktop app lag due to outdated version.
- Server disconnection: Frequent disconnection when server computer is off.
- EHR Sync break: Server app disconnected from EHR due to shutdown or crash.
- Frequent Disconnect: Internet or system frequently disconnecting.
- Adit app slow in web: Browser requires clearing cookies/cache.
- Adit app slow in desktop app: Desktop app slow due to outdated version.
- Status mapping issue: Appointment status not mapped correctly for reminders.
- Wrong business hours: Business hours incorrectly configured in Location > General.

Category: Server App
- EHR/PMS Disconnected Error on Adit app: EHR/PMS disconnected from Adit.
- Patient forms are not syncing: Sync failure due to server application issues.
- Reminders not going out: Server app failure preventing reminders from being sent.
- Payments not syncing: Adit Pay payments not syncing because of server app issue.
- EHR disconnected: Practice EHR completely disconnected.
- Practice Analytics not syncing: PA failing due to server disconnection.
- Server app resync: Server app requires syncing.
- Server app reinstall: Practice server application needs reinstallation.
- Server app install: Practice server installation required.
- EHR change: EHR/PMS needs to be changed for the practice.
- EHR disconnection frequently: PMS/EHR disconnecting repeatedly.
- Server system changed: System or configuration changes causing issues.
- High CPU usage: High CPU usage on server machine.
- EHR Crashing: EHR software crashing or unresponsive.
- Server Crashing: Server crashing or not functioning.
- EHR upgrade: Practice EHR upgrade required.
- Server App upgrade: Server app upgrade needed.
- Cloud EHR install: Cloud EHR installation required on server.
- Chrome Extension not working: Adit Chrome extension needs reconnection.
- Chrome Extension installation: Install the Adit browser extension for Chrome.

Category: Adit Pay
- Ledger Posting: Payments not posting to the EHR ledger.
- Payment Issue: Payments not syncing correctly in Adit Pay.
- Terminal Issues: Card terminal malfunctioning.
- Hardware Replacement/Return: Hardware return or replacement required.
- Demo/Basic Inquiry: Need information about Adit Pay or demo scheduled.
- Walkthrough Training: Training needed for Adit Pay module.
- Sign Up/Set Up: Adit Pay setup and onboarding.
- Terminal Registration: Card terminal registration required.
- Price Comparison: Comparing Adit Pay cost with competitors.
- Feature Request: Requested new Adit Pay feature.
- Bugs/Outage: Bugs or outages affecting Adit Pay functionality.
- Configuration/Settings: Configuration issue with Adit Pay module.
- Basic Troubleshooting: Basic troubleshooting for Adit Pay errors.
- EHR Disconnection: Adit Pay disconnected from EHR via server app.

Category: Practice Analytics
- Sync: Practice Analytics data not syncing or loading.
- Data issues: Incorrect or inaccurate PA reporting data.
- Preferences: Settings for Monthly Goals, Follow-ups, Team preferences.
- Training: Training for PA module through built-in module scheduling.
- Upgrade to Analytics: Practice needs upgrade to Analytics bundle.
- Feature Requests: New requested features for the PA module.
- Patient list Requests: Need help fetching specific patient lists.
- Export: Issues exporting reports from PA.
- Daily, Weekly, Monthly Reports: Filtering or viewing reports not working correctly.

Category: Chat Issue
- Chats not working: Live chat widget not opening or not visible.
- Chats Deleted: Chats getting deleted automatically.
- Chats not syncing: Messages delayed or not syncing across devices.

Category: Bulk Issue
- Bulk Upload / Import issue: Issue while uploading or migrating bulk data.
- Bulk SMS Issue: Messages not being sent through bulk campaigns.
- Bulk Email Issue: Emails failing during bulk messaging.

Category: Form Issue
- Form not loading: Adit forms not displaying for patients.
- Form Submission Issue: Patients unable to submit forms successfully.
- Mapping Issue: Data from forms not mapping into correct fields.

Category: Review Issue
- Reviews not coming: Reviews not syncing from sources such as Google or Facebook.
- Review link not working: Patient review request link broken or not opening.

Category: Billing Issue
- Invoice Issue: Incorrect invoice or invoice not generating.
- Refund Request: Client requesting refund due to incorrect transaction.

Category: Campaign Issue
- Campaign not working: Email or SMS campaigns not going out.
- Tracking Issue: Campaign analytics not showing accurate data.

Category: Call Tracking Issue
- Number not working: Call tracking number not receiving inbound calls.
- Call Forwarding Issue: Forwarding not working or routing to incorrect number.

Category: Adit Pay
- Payment Failure: Patients unable to complete payments.
- Payout Delay: Payout delayed or not reflecting in account.
- Refund Not Reflecting: Refund not visible in system.

Category: Permission Issue
- User Role Issue: Incorrect access permissions applied to user.
- Access Denied: User unable to access restricted areas in Adit.

Category: Telemed Issue
- Video Not Working: Telemedicine video failing to load or start.
- Audio Not Working: Audio problems during telemed sessions.
- Link Not Working: Telemed appointment link invalid or expired.

Category: Patient Sync Issue
- Patient not syncing: Patient missing in Adit after syncing with EHR.
- Duplicate Patient: Multiple profiles created for the same patient.

Category: Analytics Issue
- Report Wrong: Analytics reports show incorrect numbers.
- Dashboard not loading: Dashboard freezing or failing to load data.

Category: Appointment Issue
- Unable to book appointment: Appointment booking fails or throws an error.
- Appointment not syncing: Appointment not showing in Adit or EHR.


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
