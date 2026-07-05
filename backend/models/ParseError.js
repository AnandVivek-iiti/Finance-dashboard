const mongoose = require("mongoose");

const ParseErrorSchema = new mongoose.Schema(
  {
    statementId: { type: mongoose.Schema.Types.ObjectId, ref: "Statement", required: true, index: true },
    rowIndex: { type: Number, default: null },
    rawRow: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, required: true },
    errorType: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ParseError", ParseErrorSchema);
