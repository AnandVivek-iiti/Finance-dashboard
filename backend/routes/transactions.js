const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../middleware/errorHandler");
const {
  listTransactions,
  updateCategory,
  listDistinctCategories,
} = require("../controllers/transactionsController");

router.get("/", asyncHandler(listTransactions));
router.get("/categories", asyncHandler(listDistinctCategories));
router.patch("/:id/category", asyncHandler(updateCategory));

module.exports = router;
