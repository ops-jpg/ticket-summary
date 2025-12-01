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
-	Voicemail not working / setup issues	Users unable to access or configure voicemail settings correctly.
-	Softphone not working on Desktop:	Desktop app softphone fails to connect or make calls.
-	Softphone not working on Android	:Android softphone app fails to register or handle calls.
-	Softphone not working on iOS:	iOS softphone app not registering or crashing during use.
-Call park not working on app	 :Call park functionality unavailable or broken in mobile/desktop app.
- Number assignment errors :	Wrong or missing number assignment in the system or app.
-	Voicemail access errors	:Errors while retrieving or accessing voicemail through app or portal.
-	Update or change label/name :	Request to modify displayed name or label on app or device.
-	Wrong practice timezone configuration :	Practice time zone configured incorrectly in portal settings.
-	Call flow errors :	Incorrect or broken routing causing call flow failures.

Category: Product / Carrier Issues
-	Need isolation testing :	Require test calls or environment setup to isolate issue cause.
-	Whitelisting pending/not done :	IP or port whitelisting not completed, affecting connectivity.
-	Device-specific problems	Issue : isolated to a specific model or firmware version.
-	Server-related issues	:Problem originating from server-side configuration or outage.
-	Carrier issue with Plivo	:Carrier-side problem affecting call routing or delivery.
-	Carrier issue with Telnyx	:Telnyx carrier routing or call completion issue.
-	Porting not completed / failed:	Number port not yet completed or has failed validation.
-	Wrong or broken network configuration :	Incorrect VLAN, DNS, or IP settings causing service disruption.
-	Receiver failure (audio issues)	:Audio output failure due to hardware or network degradation.
-	Unable to send or open attachments	 :Attachments fail to upload or download in ticket/email communication.

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

Category: Training
Training	Call Flow Training	Guidance on creating and managing call routing and IVR menu options.
Training	Phone feature training	Assistance with understanding and using phone functionalities effectively.
Training	Desktop app training	Instructions on navigating and using features within the desktop application.
Training	Mobile app training	Training on accessing and managing calls through the mobile application.
Training	Call override training	Training on configuring and using call override settings.
Training	eFax training	Help with configuring and sending/receiving faxes through the eFax feature.
Training	Block caller	Steps to block unwanted numbers from reaching the phone system.
Training	Hold music	Guidance on uploading and assigning music or messages for callers on hold.
Training	Audio library	Instructions for adding greeting or IVR recordings to the audio library.
Training	Multilocation call transfer	Configuration to enable transferring calls between multiple office locations.
Training	Conference call setup	Training on creating and managing multi-party conference calls.
Training	Enable patient card	Steps to activate the patient card feature for displaying caller details.
Training	Enable call pop up	Instructions to enable on-screen pop-ups for incoming calls.
Training	Call tracking	Help with configuring call tracking to monitor and analyze call performance.
Training	E911 Setup	Guidance on registering and setting up emergency service (E911) details.
Training	Multiple Voicemail Box	Instructions for creating and managing separate voicemail boxes per user or department.

Category: Software
Software	Notifications	Desktop or mobile notifications not triggering for incoming calls or messages.
Software	VM troubleshooting	Users unable to access or configure voicemail settings correctly.
Software	Softphone troubleshooting - Desktop	Desktop app softphone fails to connect or make calls.
Software	Softphone troubleshooting - Android	Android softphone app fails to register or handle calls.
Software	Softphone troubleshooting - iOS	iOS softphone app not registering or crashing during use.
Software	Call park troubleshooting	Call park functionality unavailable or broken in mobile/desktop app.
Software	Number assignment error	Wrong or missing number assignment in the system or app.
Software	Voicemail error	Errors while retrieving or accessing voicemail through app or portal.
Software	Label name change	Request to modify displayed name or label on app or device.
Software	Practice timezone configuration	Practice time zone configured incorrectly in portal settings.
Software	Call flow error	Configured call routing not functioning as expected.

Category: Product/Carrier issues
Product/Carrier issues - L2	Isolation	Require test calls or environment setup to isolate issue cause.
Product/Carrier issues - L2	Whitelisting	IP or port whitelisting not completed, affecting connectivity.
Product/Carrier issues - L2	Device specific	Issue isolated to a specific model or firmware version.
Product/Carrier issues - L2	Server	Problem originating from server-side configuration or outage.
Product/Carrier issues - L2	Plivo	Carrier-side problem affecting call routing or delivery via Plivo.
Product/Carrier issues - L2	Telnyx	Telnyx carrier routing or call completion issue.
Product/Carrier issues - L2	Porting related	Number port not yet completed or has failed validation.
Product/Carrier issues - L2	Network configuration	Incorrect VLAN, DNS, or IP settings causing service disruption.
Product/Carrier issues - L2	Receiver failure	Audio output failure due to hardware or network degradation.
Product/Carrier issues - L2	Attachment issue	Attachments fail to upload or download in ticket/email communication.

Category: Audio quality inbound
Audio quality inbound	WL requirement	Two-way audio instability until IP/ports are whitelisted.
Audio quality inbound	Internet speed	Low bandwidth on client side causing degraded inbound audio.
Audio quality inbound	Latency	Delay in receiving audio from caller side due to network lag.
Audio quality inbound	Fluctuation	Inconsistent inbound audio caused by packet loss or jitter.
Audio quality inbound	Client expectation	Client perceives audio performance below acceptable quality.
Audio quality inbound	One-way audio	Caller can hear but not be heard (or vice versa).
Audio quality inbound	Crackly noise / static	Distorted inbound audio due to line interference or jitter.

Category: Audio quality outbound
Audio quality outbound	WL requirement	Audio failure resolved by completing IP/port whitelisting.
Audio quality outbound	Internet speed	Low upload bandwidth causing distorted outbound audio.
Audio quality outbound	Latency	Outgoing voice delayed due to high latency or routing path.
Audio quality outbound	Fluctuation	Outbound audio breaking up or cutting off intermittently.
Audio quality outbound	Client expectation	Outbound audio clarity not matching client expectations.
Audio quality outbound	One-way audio	Client cannot hear recipient; outbound RTP blocked.
Audio quality outbound	Crackly noise / static	Outgoing audio distorted by jitter or device interference.

Category:Audio quality both
Audio quality both	WL requirement	Whitelisting pending for stable audio path.
Audio quality both	Internet speed	Bandwidth issues affecting both inbound and outbound streams.
Audio quality both	Latency	Audio lag present on both ends due to route delay.
Audio quality both	Fluctuation	Audio breaks or drops intermittently in both directions.
Audio quality both	Client expectation	Audio quality below client’s expected standard in both directions.
Audio quality both	One-way audio	One-way audio persisting in both inbound/outbound tests.
Audio quality both	Crackly noise / static	Audio distorted or staticky across both channels.

Category:Caller Name / ID
Caller Name / ID	Spam calls	Frequent spam or robocalls received by the client.
Caller Name / ID	Caller name inaccuracies	Caller name shown incorrectly on inbound calls.
Caller Name / ID	Caller ID mismatch	Displayed caller ID differs from configured number.
Caller Name / ID	Update label name	Request to modify or correct caller ID label name.

Category:General Enquiries
General Enquiries	Product information	Client requesting details on existing product or feature.
General Enquiries	Feature request	Client suggesting or requesting new product functionality.
General Enquiries	Client expectation	Client concerns or expectations needing clarification.
General Enquiries	Managing users	Creating, modifying, and controlling user accounts, extensions, and access to system features.
General Enquiries	Manage permissions	Controlling user or device access rights to features, settings, and administrative functions.

Category:Custom Fix
Custom Fix	Hold reminder tone	An audible alert played to a user on hold, reminding them or the agent that the call is still active.
Custom Fix	Time zone settings	Configuring the phone system or device to the correct local time, ensuring accurate call logs, schedules, and timestamps.
Custom Fix	Call waiting tone	An audible alert that notifies a user already on a call that another incoming call is waiting.
Custom Fix	Time-out error while upgrading	When the device or system fails to complete the firmware or software update within the expected time.
Custom Fix	Speed dials	Pre-configured shortcuts that let users call frequently dialed numbers.
Custom Fix	Additional park lines	Extra lines configured on a phone system to allow multiple calls to be parked.
Custom Fix	Feature-specific workaround	Workaround for a specific feature.

Category:Bugs & Defects
Bugs & Defects	Mobile app crashes	Incidents where an application unexpectedly closes or stops functioning on a smartphone.
Bugs & Defects	Desktop app crashes	Incidents where a software application unexpectedly stops working on a computer.
Bugs & Defects	Softphone	Problems with the softphone application used to make and receive calls over the internet.
Bugs & Defects	Firmware bugs	Errors or glitches in the built-in device firmware.
Bugs & Defects	Notifications	Alerts or messages that fail to inform users about events or updates, such as incoming calls or voicemails.
Bugs & Defects	Unable to answer	Issue where incoming calls cannot be picked up or connected.
Bugs & Defects	Unable to hang up	Problem where a call does not disconnect properly after attempting to end it.
Bugs & Defects	Outage	Complete or partial loss of VoIP service due to network, server, or provider failures.
Bugs & Defects	Hardware	Problems with physical VoIP devices such as phones, headsets, or adapters.
Bugs & Defects	Voicemail issues	Issues with recording, delivering, accessing, or playing voicemail messages.
Bugs & Defects	Hold music issues	Callers experience no music, poor audio quality, wrong tracks, or silence while on hold.
Bugs & Defects	Audio library issues	Errors that occur when managing, accessing, or using audio files within the audio library.
Bugs & Defects	Software	Glitches in VoIP applications that cause call failures, poor audio quality, or connectivity issues.
Bugs & Defects	Call tracking issues	Issues related to the call tracking module or its data.
Bugs & Defects	Call flow issues	Problems in the sequence or routing of calls within a telephony system.
Bugs & Defects	Call override issues	Problems where a call fails to take priority or interrupt another call as intended.
Bugs & Defects	Inbound call (iOS)	Issues with inbound calls on iOS devices.
Bugs & Defects	CNAM (outbound)	Issues where the caller name displayed to recipients during outgoing calls is incorrect.
Bugs & Defects	CNAM (inbound)	Issues where the caller name (CNAM) for incoming calls is incorrectly displayed.

Category:Call Drop
Call Drop	WL requirement	Conditions that must be met to whitelist numbers, devices, or networks to prevent or reduce call drops.
Call Drop	Network	Calls dropping due to network issues.
Call Drop	Firmware bugs	Calls dropping due to bugs identified in firmware.

Category:Install
Install	New phone install	Process of setting up a new phone device by connecting it to the network, configuring it, and making it ready for use.
Install	Partial phone install	When a phone is set up with only basic connectivity or limited configuration.
Install	V3 migration	Upgrading or moving systems, devices, or data from an older version to version 3.
Install	Bluetooth headset install	Installing and connecting Bluetooth headsets to the phones.

Category:Desktop Phones
Desktop Phones	Phone not ringing when receiving calls	The phone doesn’t alert or ring when an incoming call is received, causing missed calls.
Desktop Phones	Unable to make outbound calls	Users are unable to place outgoing calls due to configuration, registration, or network issues.
Desktop Phones	Account not registered / logged out	The phone loses SIP registration with the server, preventing call functionality.
Desktop Phones	Keys not responding or malfunctioning	Physical buttons on the device are unresponsive or trigger incorrect actions.
Desktop Phones	Phone not powering on / random shutdowns	The phone fails to turn on or powers off unexpectedly due to hardware or power issues.
Desktop Phones	Call park not working	The call park feature doesn’t function properly, preventing users from placing calls on hold for pickup.
Desktop Phones	Firmware not updating or stuck update	Firmware upgrade fails or freezes, leaving the device in an unstable state.
Desktop Phones	Receiver not working / no audio	Users can’t hear audio or the handset/speaker produces no sound during calls.
Desktop Phones	Faulty handset or LAN ports	Hardware ports or the handset are damaged or malfunctioning, affecting connectivity.
Desktop Phones	LAN cable damaged / loose	Improper or damaged network cable connection causes phone disconnection or instability.
Desktop Phones	Bluetooth headset not connecting	The phone fails to pair or maintain connection with Bluetooth headsets.

Category:Cordless Phones
Cordless Phones	Phone not ringing when receiving calls	Cordless phone doesn’t ring or alert users on incoming calls due to registration or range issues.
Cordless Phones	Unable to make outbound calls	Users can’t make outgoing calls due to configuration or registration failure.
Cordless Phones	Account not registered / logged out	The handset loses SIP registration, disabling calling features.
Cordless Phones	Phone goes out of range	Cordless phone loses base connection when moved too far from its station.
Cordless Phones	Base station offline or disconnected	Base station disconnected from power or internet, affecting call connectivity.
Cordless Phones	Keys not responding or malfunctioning	Handset buttons not responding or triggering incorrect functions.
Cordless Phones	Phone not powering on / random shutdowns	Device fails to start or shuts down unexpectedly due to power or battery fault.
Cordless Phones	Call park not working	Call park feature not functioning correctly between cordless devices.
Cordless Phones	Firmware not updating or stuck update	Firmware upgrade process fails or hangs mid-way.
Cordless Phones	Receiver not working / no audio	No sound output from handset or base during calls.
Cordless Phones	Faulty handset or LAN ports	Faulty hardware or damaged ports affecting phone operation.
Cordless Phones	LAN cable damaged / loose	Poor network connection due to cable issue or improper connection.
Cordless Phones	Bluetooth headset not connecting	Cordless handset unable to connect or pair with Bluetooth headsets.

Category:How-To / Configuration / Settings
How-To / Configuration / Settings	Training on call flow / IVR setup	Guidance on creating and managing call routing and IVR menu options.
How-To / Configuration / Settings	Training on phone features	Assistance with understanding and using phone functionalities effectively.
How-To / Configuration / Settings	Desktop app usage training	Instructions on navigating and using features within the desktop application.
How-To / Configuration / Settings	Mobile app usage training	Training on accessing and managing calls through the mobile application.
How-To / Configuration / Settings	eFax setup or training	Help with configuring and sending/receiving faxes through the eFax feature.
How-To / Configuration / Settings	How to block a caller	Steps to block unwanted numbers from reaching the phone system.
How-To / Configuration / Settings	Setting up hold music	Guidance on uploading and assigning music or messages for callers on hold.
How-To / Configuration / Settings	Uploading audio to library	Instructions for adding greeting or IVR recordings to the audio library.
How-To / Configuration / Settings	Multi-location call transfer setup	Configuration to enable transferring calls between multiple office locations.
How-To / Configuration / Settings	Conference call setup	Training on creating and managing multi-party conference calls.
How-To / Configuration / Settings	Enabling patient card	Steps to activate the patient card feature for displaying caller details.
How-To / Configuration / Settings	Enabling call pop-up feature	Instructions to enable on-screen pop-ups for incoming calls.
How-To / Configuration / Settings	Setting up call tracking	Help with configuring call tracking to monitor and analyze call performance.
How-To / Configuration / Settings	E911 setup and configuration	Guidance on registering and setting up emergency service (E911) details.
How-To / Configuration / Settings	Creating multiple voicemail boxes	Instructions for creating and managing separate voicemail boxes per user or department.




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
- If the Owner Change Log is null or empty, treat it as: 
  "The ticket remained with the current owner for the full duration".
  In this case:
    "time_spent_per_user": "Current Owner – full duration",
    "time_spent_per_role": "Current Owner Role – full duration".

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
Calculate time spent per user STRICTLY from the Owner Change Log timestamps. 
Do not guess. 
If no timestamps exist or log is null, assume the ticket stayed with the SAME owner for the entire duration.
Return:
"CEO - 3 hrs\nBilling - 2 hrs"

7. TIME SPENT PER ROLE (MULTILINE TEXT):
Calculate time spent per role STRICTLY from the Owner Change Log timestamps. 
Do not guess. 
If no timestamps exist or log is null, assume the ticket stayed with the SAME owner for the entire duration.
Return:
"Mannat - 3 hrs\nShikha - 2 hrs"


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
