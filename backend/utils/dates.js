const MONTHS = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/**
 * Parse "05-AUG-2024" -> "2024-08-05". Returns null if the format doesn't match
 * (caller must treat as unparseable, not guess).
 */
function parseDDMMMYYYY(raw) {
  const str = String(raw || "").trim();
  const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const [, day, monAbbr, year] = m;
  const mon = MONTHS[monAbbr.toUpperCase()];
  if (!mon) return null;
  return `${year}-${mon}-${day.padStart(2, "0")}`;
}

/**
 * Parse "21/03/2025" -> "2025-03-25". Returns null if the format doesn't match.
 * Used by banks (e.g. SBI) whose exports use numeric slash-separated dates.
 */
function parseDDMMYYYYSlash(raw) {
  const str = String(raw || "").trim();
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Parse "21-03-2025" -> "2025-03-21". Returns null if the format doesn't match.
 * Used for numeric dash-separated dates, e.g. SBI's "Statement From : 21-03-2025 to 03-07-2026".
 */
function parseDDMMYYYYDash(raw) {
  const str = String(raw || "").trim();
  const m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, day, month, year] = m;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

module.exports = { parseDDMMMYYYY, parseDDMMYYYYSlash, parseDDMMYYYYDash };
