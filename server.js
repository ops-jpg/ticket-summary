import express from "express";
import crypto from "crypto";

const app = express();

// Capture raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Health check
app.get("/", (_req, res) => res.send("✅ Railway app is live!"));

// Webhook endpoint
app.post("/desk-webhook", (req, res) => {
  try {
    // Step 1: Get the X-Desk-Signature header
    const signature = req.headers["x-desk-signature"];
    if (!signature) {
      console.warn("❌ Missing X-Desk-Signature header");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Step 2: Compute the expected signature using your shared secret
    const expectedSignature = crypto
      .createHmac("sha256", process.env.DESK_SHARED_SECRET)
      .update(req.rawBody)
      .digest("hex");

    // Step 3: Verify the signatures match securely
    const signatureIsValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!signatureIsValid) {
      console.warn("❌ Invalid signature — unauthorized webhook request");
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Step 4: Handle the verified payload
    console.log("✅ Verified webhook hit:", JSON.stringify(req.body).slice(0, 2000));
    res.json({ ok: true });
  } catch (err) {
    console.error("⚠️ Error verifying webhook:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
