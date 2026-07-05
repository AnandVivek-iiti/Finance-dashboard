const mongoose = require("mongoose");

const CategoryOverrideSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    normalizedRemarks: { type: String, required: true },
    category: { type: String, required: true },
    merchantOrSource: { type: String, default: "" },
    exampleRemarks: { type: String, default: "" },
  },
  { timestamps: true }
);

// Category corrections are scoped per user - a merchant/remark pattern
// learned from one person's account must never apply to another user's.
CategoryOverrideSchema.index({ userId: 1, normalizedRemarks: 1 }, { unique: true });

module.exports = mongoose.model("CategoryOverride", CategoryOverrideSchema);
