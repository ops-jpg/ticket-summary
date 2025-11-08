import express from "express";
const app = express();

// Middleware to parse JSON
app.use(express.json());

// Health check route
app.get("/", (_req, res) => res.send("✅ Railway app is live!"));

// Webhook endpoint
app.post("/desk-webhook", (req, res) => {
  // Verify Zoho Desk shared secret
  const secret = req.headers["desk-shared-secret"];
  if (secret !== process.env.DESK_SHARED_SECRET) {
    console.warn("❌ Unauthorized webhook attempt detected");
    return res.status(403).json({ error: "Unauthorized" });
  }

  // Log incoming payload safely (truncate to avoid huge logs)
  console.log("✅ Webhook hit with payload:", JSON.stringify(req.body).slice(0, 2000));

  // Respond to Zoho Desk
  res.json({ ok: true });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
