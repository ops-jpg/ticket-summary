import express from "express";
const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.send("✅ Railway app is live!"));
app.post("/desk-webhook", (req, res) => {
  console.log("Webhook hit:", JSON.stringify(req.body).slice(0, 2000));
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
