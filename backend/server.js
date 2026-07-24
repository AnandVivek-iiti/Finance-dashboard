require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");
const requireAuth = require("./middleware/requireAuth");
const { applySecurity, authLimiter, uploadLimiter, requireXhrHeader } = require("./middleware/security");

const authRoutes = require("./routes/auth");
const uploadRoutes = require("./routes/upload");
const statementsRoutes = require("./routes/statements");
const metricsRoutes = require("./routes/metrics");
const transactionsRoutes = require("./routes/transactions");

const app = express();

app.set("trust proxy", 1);

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

applySecurity(app);

app.use(express.json());
app.use(cookieParser());
app.use(requireXhrHeader);

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "finance-dashboard-api" });
});

app.use("/api/auth", authLimiter, authRoutes);

app.use("/api/upload", requireAuth, uploadLimiter, uploadRoutes);
app.use("/api/statements", requireAuth, statementsRoutes);
app.use("/api/metrics", requireAuth, metricsRoutes);
app.use("/api/transactions", requireAuth, transactionsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
});