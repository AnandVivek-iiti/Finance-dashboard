const mongoose = require("mongoose");

const CategoryOverrideSchema = new mongoose.Schema(
  {
    normalizedRemarks: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true },
    merchantOrSource: { type: String, default: "" },
    exampleRemarks: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CategoryOverride", CategoryOverrideSchema);
