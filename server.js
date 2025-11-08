import express from "express";

const app = express();

// Use JSON parser
app.use(express.json({ limit: "5mb" }));

// Health route
app.get("/", (_req, res) => res.send("✅ Railway app is live!"));

// Webhook route
app.post("/desk-webhook", (req, res) => {
  try {
    // 1️⃣ Verify shared secret header
    const secretHeader = req.headers["desk-shared-secret"];
    const sharedSecret = process.env.DESK_SHARED_SECRET;

    if (!secretHeader || !sharedSecret) {
      console.warn("❌ Missing secret or env var");
      return res.status(400).json({ error: "Missing secret" });
    }

    // Simple equality check (NOT timingSafeEqual — avoids buffer error)
    if (secretHeader.trim() !== sharedSecret.trim()) {
      console.warn("🚫 Invalid desk-shared-secret");
      return res.status(403).json({ error: "Unauthorized" });
    }

    // 2️⃣ Log incoming webhook safely
    console.log("✅ Webhook hit:", JSON.stringify(req.body).slice(0, 2000));

    // 3️⃣ Respond success
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error verifying webhook:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
