const express = require("express");
const app = express();

app.use(express.json());

// Test endpoint
app.get("/", (req, res) => {
  res.send("✅ Server is running");
});

// Your webhook endpoint
app.post("/webhook", (req, res) => {
  console.log("Received:", req.body);
  res.send("OK");
});

// Railway will set PORT automatically
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
