import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "5mb" }));

const DESK_SHARED_SECRET = process.env.DESK_SHARED_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// -------- 1. Your reference list (shortened if needed) --------
const referenceList = `
Category: Desktop Phones
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
- Bluetooth headset installation
`.trim();

// -------- 2. Build a "myquestion" style prompt ----------
function buildPrompt(payload) {
  const {
    subject = "N/A",
    status = "N/A",
    priority = "N/A",
    channel = "N/A",
    department = "N/A",
    conversation = "No conversation."
  } = payload || {};

  return (
    "You are an AI Ticket Audit Assistant. Analyze this Zoho Desk ticket for 360° agent performance using only the provided data. " +
    "Evaluate follow-ups, tone, and resolution quality.\n\n" +
    "1. FOLLOW-UP AUDIT:\n" +
    "Check if the agent promised any callback/follow-up and whether it was completed.\n" +
    "Classify as exactly one of:\n" +
    "- Follow-up Completed\n" +
    "- Delayed Follow-up\n" +
    "- Missed Follow-up\n" +
    "- No Commitment Found\n\n" +
    "2. CATEGORY & SUBCATEGORY CLASSIFICATION (STRICT):\n" +
    "Use ONLY the Category → Subcategory reference list given below.\n" +
    "- DO NOT create new names.\n" +
    "- DO NOT modify labels.\n" +
    "- If no perfect match, select the closest best match.\n\n" +
    "REFERENCE CATEGORY → SUBCATEGORY LIST:\n" +
    referenceList + "\n\n" +
    "3. SCORING (0–10 each):\n" +
    "- Follow-Up Frequency\n" +
    "- No Drops\n" +
    "- SLA Adherence\n" +
    "- Resolution Quality\n" +
    "- Customer Sentiment (-10 to +10)\n" +
    "- Agent Tone\n\n" +
    "4. FINAL AI TICKET SCORE (0–10 weighted):\n" +
    "- Follow-Up 15%\n" +
    "- No Drops 15%\n" +
    "- SLA 20%\n" +
    "- Resolution 20%\n" +
    "- Sentiment 15%\n" +
    "- Tone 15%\n\n" +
    "Output a single JSON object ONLY with this structure:\n" +
    "{\n" +
    '  "title": "Ticket Follow-up Analysis",\n' +
    '  "follow_up_status": "<one of the four statuses>",\n' +
    '  "category": "<Category from list>",\n' +
    '  "subcategory": "<Subcategory from list>",\n' +
    '  "scores": {\n' +
    '    "follow_up_frequency": 0,\n' +
    '    "no_drops": 0,\n' +
    '    "sla_adherence": 0,\n' +
    '    "resolution_quality": 0,\n' +
    '    "customer_sentiment": 0,\n' +
    '    "agent_tone": 0\n' +
    "  },\n" +
    '  "final_score": 0,\n' +
    '  "reasons": "Short explanation of the score"\n' +
    "}\n\n" +
    "Ticket Info → Subject: " + subject +
    ", Status: " + status +
    ", Priority: " + priority +
    ", Channel: " + channel +
    ", Department: " + department +
    ".\n\n" +
    "Conversation:\n" + conversation
  );
}

// -------- 3. Call OpenAI ----------
async function classifyTicket(payload) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const prompt = buildPrompt(payload);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a strict JSON generator. Only output valid JSON matching the given schema." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("OpenAI error response:", text);
    throw new Error("OpenAI API error " + resp.status);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "{}";

  // response_format=json_object => content is already JSON string
  const parsed = JSON.parse(content);
  return parsed;
}

// -------- 4. Routes ----------
app.get("/", (_req, res) => {
  res.send("✅ Railway app is live!");
});

app.post("/desk-webhook", async (req, res) => {
  try {
    // 1) Check shared secret
    const headerSecret = req.headers["desk-shared-secret"];
    if (!headerSecret || !DESK_SHARED_SECRET || headerSecret !== DESK_SHARED_SECRET) {
      console.warn("❌ Unauthorized webhook");
      return res.status(403).json({ error: "Unauthorized" });
    }

    const payload = req.body || {};
    console.log("📥 Webhook payload preview:", JSON.stringify(payload).slice(0, 500));

    // 2) Call OpenAI for classification
    const aiResult = await classifyTicket(payload);
    console.log("🧠 AI result:", JSON.stringify(aiResult).slice(0, 500));

    // 3) Return AI result back to Zoho function
    return res.json({ ok: true, ai: aiResult });
  } catch (err) {
    console.error("🔥 Handler error:", err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
