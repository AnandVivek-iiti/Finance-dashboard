require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { errorHandler } = require("./middleware/errorHandler");

const uploadRoutes = require("./routes/upload");
const statementsRoutes = require("./routes/statements");
const metricsRoutes = require("./routes/metrics");
const transactionsRoutes = require("./routes/transactions");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "finance-dashboard-api" });
});

app.use("/api/upload", uploadRoutes);
app.use("/api/statements", statementsRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/transactions", transactionsRoutes);

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
