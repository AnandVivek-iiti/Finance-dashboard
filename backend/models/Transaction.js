const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema(
  {
    // Duplicated from Statement on purpose (defense-in-depth): filter by
    // userId directly here instead of only trusting statementId ownership,
    // so a bug in a controller's join logic can't leak another user's rows.
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    statementId: { type: mongoose.Schema.Types.ObjectId, ref: "Statement", required: true, index: true },

    date: { type: Date, required: true, index: true },
    transactionId: { type: String, default: "" },

    // Integer paise. Exactly one of these two is non-null per row.
    withdrawalPaise: { type: Number, default: null },
    depositPaise: { type: Number, default: null },
    balancePaise: { type: Number, required: true },

    remarks: { type: String, default: "" },
    type: { type: String, enum: ["debit", "credit"], required: true },

    category: { type: String, default: "Uncategorized" },
    merchantOrSource: { type: String, default: "" },

    // true if a human corrected the auto-assigned category via the UI
    categoryManuallySet: { type: Boolean, default: false },

    reconciled: { type: Boolean, default: true },

    rawRowIndex: { type: Number, default: null }, // source row, for debugging/tracing
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, statementId: 1, date: 1 });
TransactionSchema.index({ userId: 1, statementId: 1, category: 1 });
TransactionSchema.index({ userId: 1, statementId: 1, type: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);
