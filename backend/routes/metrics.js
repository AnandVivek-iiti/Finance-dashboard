const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const { getMetrics } = require("../controllers/metricsController");

router.get("/", asyncHandler(getMetrics));

module.exports = router;
