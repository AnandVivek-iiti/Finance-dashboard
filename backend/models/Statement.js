const mongoose = require("mongoose");

const StatementSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    bankProfile: { type: String, default: "unknown" }, // e.g. "canara_bank"
    accountNumber: { type: String, default: "" },
    accountHolderName: { type: String, default: "" },
    branchName: { type: String, default: "" },
    ifscCode: { type: String, default: "" },

    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },

    openingBalancePaise: { type: Number, default: null },
    closingBalancePaise: { type: Number, default: null },

    transactionCount: { type: Number, default: 0 },
    parseErrorCount: { type: Number, default: 0 },

    status: { type: String, default: "processing" },
    failureReason: { type: String, default: "" },

    continuityWarning: { type: mongoose.Schema.Types.Mixed, default: null },

    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Statement", StatementSchema);
