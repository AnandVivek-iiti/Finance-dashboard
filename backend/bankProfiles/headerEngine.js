const { normalizeHeader } = require("../utils/headerNormalize");
const { SYNONYMS } = require("../utils/synonyms");
const { similarity } = require("../utils/fuzzyMatch");

const FUZZY_THRESHOLD = 0.72;
const HEADER_CONFIDENCE_THRESHOLD = 0.55;
const MAX_HEADER_SCAN_ROWS = 60;

const ALL_FIELDS = ["date", "transactionId", "withdrawal", "deposit", "amount", "drCrIndicator", "balance", "remarks"];

function cellText(row, i) {
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
}

function matchFieldInRow(normalizedCells, field) {
  const synonyms = SYNONYMS[field];
  let best = null;
  for (let idx = 0; idx < normalizedCells.length; idx++) {
    const text = normalizedCells[idx];
    if (!text) continue;
    for (const syn of synonyms) {
      let score;
      if (text === syn) score = 1;
      else if (text.includes(syn) || syn.includes(text)) score = 0.9;
      else score = similarity(text, syn);
      if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
        best = { idx, score, matchedSynonym: syn };
      }
    }
  }
  return best;
}

function detectColumnsInRow(normalizedCells) {
  const rawMatches = {};
  for (const field of ALL_FIELDS) {
    const m = matchFieldInRow(normalizedCells, field);
    if (m) rawMatches[field] = m;
  }

  const byIdx = {};
  for (const [field, m] of Object.entries(rawMatches)) {
    const existing = byIdx[m.idx];
    if (!existing || m.score > existing.score) byIdx[m.idx] = { field, score: m.score };
  }

  const columnMap = {};
  const fieldConfidence = {};
  for (const [idxStr, { field, score }] of Object.entries(byIdx)) {
    columnMap[field] = Number(idxStr);
    fieldConfidence[field] = score;
  }
  return { columnMap, fieldConfidence };
}

function mergeRows(rowA, rowB) {
  const len = Math.max(rowA?.length || 0, rowB?.length || 0);
  const merged = [];
  for (let i = 0; i < len; i++) {
    const a = cellText(rowA, i);
    const b = cellText(rowB, i);
    merged.push([a, b].filter(Boolean).join(" ").trim());
  }
  return merged;
}

function hasCoreFields(columnMap) {
  const hasAmountPair = columnMap.withdrawal !== undefined && columnMap.deposit !== undefined;
  const hasSignedAmount = columnMap.amount !== undefined;
  return columnMap.date !== undefined && columnMap.balance !== undefined && (hasAmountPair || hasSignedAmount);
}

function overallConfidence(fieldConfidence, columnMap) {
  const coreFields = ["date", "balance"];
  if (columnMap.withdrawal !== undefined && columnMap.deposit !== undefined) {
    coreFields.push("withdrawal", "deposit");
  } else if (columnMap.amount !== undefined) {
    coreFields.push("amount");
  }
  const scores = coreFields.map((f) => fieldConfidence[f] ?? 0);
  if (scores.length === 0) return 0;
  return Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3));
}

function findHeaderCandidates(rows) {
  const candidates = [];
  const scanLimit = Math.min(rows.length, MAX_HEADER_SCAN_ROWS);

  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r] || [];
    const normalizedCells = row.map((c) => normalizeHeader(c));
    if (normalizedCells.every((c) => !c)) continue;

    const single = detectColumnsInRow(normalizedCells);
    const singleConfidence = overallConfidence(single.fieldConfidence, single.columnMap);
    if (hasCoreFields(single.columnMap)) {
      candidates.push({
        headerRowIndex: r,
        headerRowSpan: 1,
        columnMap: single.columnMap,
        fieldConfidence: single.fieldConfidence,
        confidence: singleConfidence,
      });
    }

    if (r + 1 < scanLimit) {
      const nextRow = rows[r + 1] || [];
      const mergedCells = mergeRows(row, nextRow).map((c) => normalizeHeader(c));
      if (!mergedCells.every((c) => !c)) {
        const merged = detectColumnsInRow(mergedCells);
        const mergedConfidence = overallConfidence(merged.fieldConfidence, merged.columnMap);
        if (hasCoreFields(merged.columnMap) && mergedConfidence > singleConfidence) {
          candidates.push({
            headerRowIndex: r + 1,
            headerRowSpan: 2,
            columnMap: merged.columnMap,
            fieldConfidence: merged.fieldConfidence,
            confidence: mergedConfidence,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates;
}

function buildDiagnostics(candidates) {
  if (candidates.length === 0) {
    return { possibleHeaderRowsFound: 0, message: "No candidate header rows were found in this file." };
  }
  const best = candidates[0];
  const missing = [];
  if (best.columnMap.date === undefined) missing.push("date");
  if (best.columnMap.balance === undefined) missing.push("balance");
  if (best.columnMap.withdrawal === undefined && best.columnMap.amount === undefined) missing.push("withdrawal");
  if (best.columnMap.deposit === undefined && best.columnMap.amount === undefined) missing.push("deposit");

  const notes = [];
  if (best.columnMap.balance !== undefined) notes.push("Possible balance column at index " + best.columnMap.balance);
  if (best.columnMap.remarks !== undefined) notes.push("Possible narration column at index " + best.columnMap.remarks);

  return {
    possibleHeaderRowsFound: candidates.length,
    bestConfidence: best.confidence,
    missingFields: missing,
    notes,
  };
}

function detectHeader(rows) {
  const candidates = findHeaderCandidates(rows);
  const diagnostics = buildDiagnostics(candidates);
  if (candidates.length === 0) return { best: null, candidates, diagnostics };

  const best = candidates[0];
  if (best.confidence < HEADER_CONFIDENCE_THRESHOLD) return { best: null, candidates, diagnostics };
  return { best, candidates, diagnostics };
}

module.exports = { detectHeader, findHeaderCandidates, detectColumnsInRow, HEADER_CONFIDENCE_THRESHOLD };
