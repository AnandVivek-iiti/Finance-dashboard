const { callGroqChatCompletion, isConfigured, GROQ_FALLBACK_MODEL } = require("./groqClient");
const { normalizeHeader } = require("../utils/headerNormalize");
const { resolveSignedAmount } = require("../utils/signedAmount");

const TARGET_HEADERS = ["Date", "Transaction ID", "Withdrawal", "Deposit", "Balance", "Remarks"];
const SAMPLE_ROWS_SENT = 20;
const MAX_COMPLETION_TOKENS = Number(process.env.GROQ_FALLBACK_MAX_TOKENS) || 500;
const MAPPING_PROMPT = `You are looking at a small sample from a bank statement spreadsheet or PDF table. The column headers use wording this app's known bank profiles don't recognize (unfamiliar bank, unusual abbreviations, merged header cells, etc). Your job is ONLY to identify which row is the header and which column index (0-based) holds each field. Do NOT transcribe or rewrite any transaction data.

Return ONLY JSON matching this exact shape:
{
  "headerRow": <0-based row index of the header within the sample, or -1 if none found>,
  "dateColumn": <0-based column index or -1>,
  "transactionIdColumn": <0-based column index or -1>,
  "withdrawalColumn": <0-based column index or -1, -1 if this statement uses a single signed amount column instead>,
  "depositColumn": <0-based column index or -1, -1 if this statement uses a single signed amount column instead>,
  "amountColumn": <0-based column index or -1, only if there is a single signed amount column instead of separate withdrawal/deposit columns>,
  "drCrIndicatorColumn": <0-based column index or -1, a column marking Dr/Cr type paired with amountColumn>,
  "balanceColumn": <0-based column index or -1>,
  "remarksColumn": <0-based column index or -1>,
  "confidence": <number 0.0-1.0, your honest confidence in this mapping>
}

Rules:
- Column indices refer to positions in the raw row arrays shown below, counting from 0.
- If you cannot confidently identify the table at all, return confidence 0.0 and -1 for every column.
- Respond with ONLY the JSON object above. No prose, no markdown code fences, no commentary before or after it.

Sample rows (as a JSON array of arrays, one inner array per source row, in original order):
`;

function assertGroqConfigured() {
  if (!isConfigured()) {
    const err = new Error(
      "This bank's export format isn't recognized, and AI-assisted fallback requires GROQ_API_KEY, which is not set. " +
        "Add GROQ_API_KEY to backend/.env to enable AI-assisted parsing for unrecognized formats."
    );
    err.code = "AI_FALLBACK_NOT_CONFIGURED";
    err.expose = true;
    throw err;
  }
}

async function requestColumnMapping(sampleRows) {
  const body = {
    model: GROQ_FALLBACK_MODEL,
    temperature: 0,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: MAPPING_PROMPT + JSON.stringify(sampleRows) }],
  };

  let data;
  try {
    data = await callGroqChatCompletion(body);
  } catch (e) {
    const err = new Error(`AI fallback request failed: ${e.message}`);
    err.code = "AI_FALLBACK_API_ERROR";
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    const err = new Error("AI fallback returned an empty response.");
    err.code = "AI_FALLBACK_API_ERROR";
    throw err;
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    const err = new Error("AI fallback returned output that was not valid JSON.");
    err.code = "AI_FALLBACK_API_ERROR";
    throw err;
  }
}

function toColumnMap(mapping) {
  const columnMap = {};
  if (mapping.dateColumn >= 0) columnMap.date = mapping.dateColumn;
  if (mapping.transactionIdColumn >= 0) columnMap.transactionId = mapping.transactionIdColumn;
  if (mapping.withdrawalColumn >= 0) columnMap.withdrawal = mapping.withdrawalColumn;
  if (mapping.depositColumn >= 0) columnMap.deposit = mapping.depositColumn;
  if (mapping.amountColumn >= 0) columnMap.amount = mapping.amountColumn;
  if (mapping.drCrIndicatorColumn >= 0) columnMap.drCrIndicator = mapping.drCrIndicatorColumn;
  if (mapping.balanceColumn >= 0) columnMap.balance = mapping.balanceColumn;
  if (mapping.remarksColumn >= 0) columnMap.remarks = mapping.remarksColumn;
  return columnMap;
}

function cell(row, i) {
  return row && row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
}

function projectRowsToCanonicalShape(rows, columnMap, headerRowIndexAbsolute) {
  const canonicalRows = [];
  for (let r = headerRowIndexAbsolute + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((v) => v === null || v === undefined || String(v).trim() === "")) continue;

    let withdrawal = columnMap.withdrawal !== undefined ? cell(row, columnMap.withdrawal) : "";
    let deposit = columnMap.deposit !== undefined ? cell(row, columnMap.deposit) : "";

    if (columnMap.amount !== undefined && !withdrawal && !deposit) {
      const indicatorRaw = columnMap.drCrIndicator !== undefined ? cell(row, columnMap.drCrIndicator) : undefined;
      const resolved = resolveSignedAmount(cell(row, columnMap.amount), indicatorRaw);
      withdrawal = resolved.withdrawalPaise !== null ? String(resolved.withdrawalPaise / 100) : "";
      deposit = resolved.depositPaise !== null ? String(resolved.depositPaise / 100) : "";
    }

    canonicalRows.push([
      columnMap.date !== undefined ? cell(row, columnMap.date) : "",
      columnMap.transactionId !== undefined ? cell(row, columnMap.transactionId) : "",
      withdrawal,
      deposit,
      columnMap.balance !== undefined ? cell(row, columnMap.balance) : "",
      columnMap.remarks !== undefined ? cell(row, columnMap.remarks) : "",
    ]);
  }
  return canonicalRows;
}

async function reinterpretRowsViaAI(rows) {
  assertGroqConfigured();

  const sample = rows.slice(0, SAMPLE_ROWS_SENT);
   void sample.map((row) => (row || []).map((c) => normalizeHeader(c)));

  const mapping = await requestColumnMapping(sample);

  const confidence = typeof mapping.confidence === "number" ? mapping.confidence : 0;
  const headerRowRelative = typeof mapping.headerRow === "number" ? mapping.headerRow : -1;

  if (headerRowRelative < 0 || confidence <= 0) {
    const err = new Error(
      "AI fallback ran but could not confidently locate a transaction table in this file either. " +
        "This bank's export format genuinely isn't supported yet."
    );
    err.code = "AI_FALLBACK_NO_ROWS";
    err.expose = true;
    throw err;
  }

  const columnMap = toColumnMap(mapping);
  const canonicalRows = projectRowsToCanonicalShape(rows, columnMap, headerRowRelative);

  if (canonicalRows.length === 0) {
    const err = new Error(
      "AI fallback located a header but no transaction rows followed it. " +
        "This bank's export format genuinely isn't supported yet."
    );
    err.code = "AI_FALLBACK_NO_ROWS";
    err.expose = true;
    throw err;
  }

  const result = [TARGET_HEADERS, ...canonicalRows];
  result.aiFallbackUsed = true;
  result.aiFallbackConfidence = confidence;
  result.aiFallbackTruncated = false;
  return result;
}

module.exports = { reinterpretRowsViaAI };