const canara = require("./canara");
const sbi = require("./sbi");
const generic = require("./generic");

// Order matters: more specific profiles first, generic fallback last.
const PROFILES = [canara, sbi, generic];
 
function detectProfile(rows) {
  for (const profile of PROFILES) {
    const found = profile.findHeaderRow(rows);
    if (found) {
      return { profile, headerRowIndex: found.headerRowIndex, columnMap: found.columnMap };
    }
  }
  return null;
}

module.exports = { detectProfile, PROFILES };