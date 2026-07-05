
const RULES = [
  { pattern: /ATM CASH|ATM-CASH|ATM WDL/i, category: "ATM Withdrawal" },
  { pattern: /CASH DEPOSIT/i, category: "Cash Deposit" },
  { pattern: /\bNEFT\s*CR\b|\bNEFT DR-.*CR\b/i, category: "Bank Transfer (In)" },
  { pattern: /\bNEFT\s*DR\b/i, category: "Bank Transfer (Out)" },
  { pattern: /\bIMPS\b/i, category: "Bank Transfer (IMPS)" },
  { pattern: /\bRTGS\b/i, category: "Bank Transfer (RTGS)" },
  { pattern: /\bUPI\b/i, category: "UPI Payment" },
  { pattern: /NEFT SC|SERVICE CHARGE|SC CHARGE|AMB CHARGE|MIN BAL/i, category: "Bank Charges" },
  { pattern: /EXPERIAN|CIBIL|CREDIT INFO/i, category: "Credit Score Service" },
  { pattern: /SALARY|SAL CREDIT/i, category: "Salary" },
  { pattern: /INTEREST CREDIT|INT\.PD|INT CR/i, category: "Interest Credit" },
  { pattern: /ELECTRICITY|POWER BILL|MPPKVVCL|DISCOM/i, category: "Utilities - Electricity" },
  { pattern: /RECHARGE|JIO|AIRTEL|VODAFONE|VI\b/i, category: "Mobile/Recharge" },
  { pattern: /SWIGGY|ZOMATO|FOOD/i, category: "Food & Dining" },
  { pattern: /AMAZON|FLIPKART|MYNTRA/i, category: "Shopping" },
  { pattern: /IRCTC|OLA|UBER|REDBUS/i, category: "Travel & Transport" },
  { pattern: /RENT/i, category: "Rent" },
  { pattern: /EMI|LOAN/i, category: "Loan/EMI" },
  { pattern: /INSURANCE|LIC/i, category: "Insurance" },
  { pattern: /TUITION|COURSE|EDUCATION|IIT/i, category: "Education" },
  { pattern: /POS\b|CARD PURCHASE/i, category: "Card Purchase" },
  { pattern: /CHEQUE|CHQ/i, category: "Cheque" },
];

const DEFAULT_DEBIT_CATEGORY = "Uncategorized Expense";
const DEFAULT_CREDIT_CATEGORY = "Uncategorized Income";


function normalizeRemarks(remarks) {
  return String(remarks || "")
    .toLowerCase()
    .replace(/\d{6,}/g, "") // strip long reference numbers / timestamps
    .replace(/[^a-z\s]/g, " ") // strip punctuation/digits
    .replace(/\s+/g, " ")
    .trim();
}

function extractMerchant(remarks) {
  const cleaned = String(remarks || "").trim();

  if (/^UPI\//i.test(cleaned)) {
    const segments = cleaned.split("/");
    const name = segments[3]?.trim();
    if (name && name.length >= 2 && !/^\d+$/.test(name)) return name;
  }

  const parts = cleaned.split("-").map((p) => p.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (/^\d+$/.test(p)) continue;
    if (/^[A-Z]{4}\d{7}$/.test(p)) continue; // looks like an IFSC code
    if (/^\d{1,2}[/:]\d{1,2}([/:]\d{1,4})?$/.test(p)) continue; // date/time fragment
    if (p.length >= 3) return p;
  }

  return cleaned.slice(0, 40);
}


function categorize(remarks, type, overridesMap) {
  const normalized = normalizeRemarks(remarks);

  const override = overridesMap?.get(normalized);
  if (override) {
    return {
      category: override.category,
      merchantOrSource: override.merchantOrSource || extractMerchant(remarks),
      normalizedRemarks: normalized,
    };
  }

  for (const rule of RULES) {
    if (rule.pattern.test(remarks)) {
      return {
        category: rule.category,
        merchantOrSource: extractMerchant(remarks),
        normalizedRemarks: normalized,
      };
    }
  }

  return {
    category: type === "credit" ? DEFAULT_CREDIT_CATEGORY : DEFAULT_DEBIT_CATEGORY,
    merchantOrSource: extractMerchant(remarks),
    normalizedRemarks: normalized,
  };
}

module.exports = { categorize, normalizeRemarks, extractMerchant, RULES };
