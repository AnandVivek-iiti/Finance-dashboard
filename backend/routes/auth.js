const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const requireAuth = require("../middleware/requireAuth");
const { googleLogin, getMe, logout } = require("../controllers/authController");

router.post("/google", asyncHandler(googleLogin));
router.get("/me", requireAuth, asyncHandler(getMe));
router.post("/logout", requireAuth, asyncHandler(logout));

module.exports = router;
