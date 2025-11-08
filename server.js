import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ verify: rawBodySaver }));

// Middleware to capture raw request body for signature verification
function rawBodySaver(req, res, buf) {
  req.rawBody = buf.toString();
}

// Health check route
app.get("/", (_req, res) => res.send("✅ Railway app is live!"));

// Zoho Desk Webhook
app.post("/desk-webhook", (req, res) => {
  try {
    // Step 1: Extract signature header
    const signature = req.headers["x-desk-signature"];
    if (!signature) {
      console.warn("❌ Missing X-Desk-Signature header");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Step 2: Compute HMAC using your shared secret
    const expectedSignature = crypto
      .createHmac("sha256", process.env.DESK_SHARED_SECRET)
      .update(req.rawBody)
      .digest("hex");

    // Step 3: Compare securely
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.warn("❌ Invalid signature – possible spoofed request");
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Step 4: Valid request – process payload
    console.log("✅ Verified webhook hit:", JSON.stringify(req.body).slice(0, 2000));
    res.json({ ok: true });
  } catch (err) {
    console.error("⚠️ Error verifying webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
