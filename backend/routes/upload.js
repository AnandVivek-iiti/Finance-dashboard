const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { asyncHandler } = require("../middleware/errorHandler");
const { handleUpload } = require("../controllers/uploadController");

router.post("/", upload.single("statement"), asyncHandler(handleUpload));

module.exports = router;
