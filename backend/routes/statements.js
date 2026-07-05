const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const {
  listStatements,
  getStatement,
  getParseErrors,
  deleteStatement,
} = require("../controllers/statementsController");

router.get("/", asyncHandler(listStatements));
router.get("/:id", asyncHandler(getStatement));
router.get("/:id/parse-errors", asyncHandler(getParseErrors));
router.delete("/:id", asyncHandler(deleteStatement));

module.exports = router;
