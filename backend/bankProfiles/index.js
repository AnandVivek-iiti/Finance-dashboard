const canara = require("./canara");
const sbi = require("./sbi");
const generic = require("./generic");
const { detectHeader } = require("./headerEngine");

// Header detection is fully shared (headerEngine). This list is only used
// to pick which profile supplies metadata/skip-rules/balance-extraction.
const BANK_PROFILES = [canara, sbi];

function identifyBankProfile(rows) {
  for (const profile of BANK_PROFILES) {
    if (profile.identify && profile.identify(rows)) return profile;
  }
  return generic;
}

function detectProfile(rows) {
  const { best, diagnostics } = detectHeader(rows);
  if (!best) return null;

  const profile = identifyBankProfile(rows);
  return {
    profile,
    headerRowIndex: best.headerRowIndex,
    columnMap: best.columnMap,
    confidence: best.confidence,
    diagnostics,
  };
}

function detectProfileDiagnostics(rows) {
  return detectHeader(rows).diagnostics;
}

module.exports = { detectProfile, detectProfileDiagnostics, PROFILES: [...BANK_PROFILES, generic] };