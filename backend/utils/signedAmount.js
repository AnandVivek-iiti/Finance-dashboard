const { parseAmountToPaise } = require("./money");

function stripCrDrSuffix(raw) {
  if (raw === null || raw === undefined) return raw;
  return String(raw).replace(/\s*(cr|dr)\s*$/i, "");
}

function isCreditIndicator(raw) {
  return /^(cr|c|credit)$/i.test(String(raw || "").trim());
}

function isDebitIndicator(raw) {
  return /^(dr|d|debit)$/i.test(String(raw || "").trim());
}

function resolveSignedAmount(rawAmount, indicatorRaw) {
  if (rawAmount === null || rawAmount === undefined) return { withdrawalPaise: null, depositPaise: null };

  let cleaned = String(rawAmount).trim();
  if (!cleaned) return { withdrawalPaise: null, depositPaise: null };

  let isParenNegative = false;
  if (/^\(.*\)$/.test(cleaned)) {
    isParenNegative = true;
    cleaned = cleaned.slice(1, -1).trim();
  }

  const hasCrSuffix = /cr\s*$/i.test(cleaned);
  const hasDrSuffix = /dr\s*$/i.test(cleaned);
  cleaned = stripCrDrSuffix(cleaned);

  const amountPaise = parseAmountToPaise(cleaned);
  if (amountPaise === null) return { withdrawalPaise: null, depositPaise: null };

  const magnitude = Math.abs(amountPaise);

  if (indicatorRaw !== undefined && indicatorRaw !== null && String(indicatorRaw).trim() !== "") {
    if (isCreditIndicator(indicatorRaw)) return { withdrawalPaise: null, depositPaise: magnitude };
    if (isDebitIndicator(indicatorRaw)) return { withdrawalPaise: magnitude, depositPaise: null };
  }
  if (hasCrSuffix) return { withdrawalPaise: null, depositPaise: magnitude };
  if (hasDrSuffix) return { withdrawalPaise: magnitude, depositPaise: null };
  if (isParenNegative || amountPaise < 0) return { withdrawalPaise: magnitude, depositPaise: null };
  return { withdrawalPaise: null, depositPaise: magnitude };
}

module.exports = { resolveSignedAmount, stripCrDrSuffix };
