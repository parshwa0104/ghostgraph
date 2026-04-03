/* ═══════════════════════════════════════════════════════════
   GhostGraph Server v3.2
   E2EE relay backend — stores only encrypted data
   ═══════════════════════════════════════════════════════════ */

require("dotenv").config();
const connectDB = require('./config/db');

const express = require("express");
const cors = require("cors");
const path = require("path");
const { errorHandler } = require("./middleware/errorHandler");
const { rateLimiter } = require("./middleware/rateLimiter");

const packetRoutes = require("./routes/packets");
const fileRoutes = require("./routes/files");
const chainRoutes = require("./routes/chain");
const rewardRoutes = require("./routes/rewards");
const adminRoutes = require("./routes/admin");

const app = express();
// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 3000;

/* ── Middleware ── */
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(rateLimiter);

/* ── API Routes ── */
app.use("/api/packets", packetRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/chain", chainRoutes);
app.use("/api/rewards", rewardRoutes);
app.use("/api/admin", adminRoutes);

/* ── Health Check ── */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "ghostgraph-v3.2",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/* ── Serve Frontend ── */
app.use(express.static(path.join(__dirname, "..")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

/* ── Error Handler ── */
app.use(errorHandler);

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║  👻 GhostGraph Server v3.2           ║`);
  console.log(`  ║  Running on http://localhost:${PORT}    ║`);
  console.log(`  ║  E2EE relay — no plaintext access    ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});

module.exports = app;
