const { callGroqChatCompletion, isConfigured, GROQ_FALLBACK_MODEL } = require("./groqClient");

const TARGET_HEADERS = ["Date", "Transaction ID", "Withdrawal", "Deposit", "Balance", "Remarks"];
const MAX_ROWS_SENT = 800;

const ROWS_PER_CHUNK = Number(process.env.GROQ_FALLBACK_ROWS_PER_CHUNK) || 40;
const MAX_COMPLETION_TOKENS = Number(process.env.GROQ_FALLBACK_MAX_TOKENS) || 3000;

const INTER_CHUNK_DELAY_MS = Number(process.env.GROQ_FALLBACK_CHUNK_DELAY_MS) || 500;
const MIN_SPLIT_CHUNK_SIZE = 5; // give up splitting further and surface the real error below this

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Groq returns this when the model runs out of max_completion_tokens mid-JSON
// (e.g. a chunk with unusually long remarks/narration text). Splitting the
// chunk in half and retrying self-heals this without needing a perfect
// ROWS_PER_CHUNK guess for every statement.
function isTokenExhaustionError(message) {
  return /json_validate_failed|max completion tokens/i.test(message || "");
}

const FALLBACK_PROMPT = `You are looking at raw rows extracted from a bank statement spreadsheet or PDF table. The column headers use wording this app's known bank profiles don't recognize (unfamiliar bank, unusual abbreviations, merged header cells, etc). Your job is to find the transaction table within these rows and re-map it into a fixed canonical shape.

Return ONLY JSON matching this exact shape:
{
  "confidence": <number 0.0-1.0, your honest confidence that every row was mapped correctly>,
  "rows": [
    ["<date>", "<transaction id / cheque / reference no, or empty string>", "<withdrawal amount or empty string>", "<deposit amount or empty string>", "<balance amount or empty string>", "<remarks/narration/particulars>"]
  ]
}

Rules:
- One array per transaction row, in the order they appear top to bottom. Skip header rows, blank rows, and any metadata rows above/below the table (account info, disclaimers, summary blocks).
- Dates: output as DD/MM/YYYY (convert if the source uses a different format).
- Amounts: plain numbers only, no currency symbols, no thousands separators, no "Cr"/"Dr" suffixes (e.g. "1500.00" not "₹1,500.00" or "1500.00 Cr"). Use an empty string "" if a cell is blank, not "0".
- Every row must have EITHER a withdrawal OR a deposit amount (not both, not neither) - if the source uses a single signed "Amount" column, split it based on the sign or a Dr/Cr indicator column.
- If you cannot confidently locate a transaction table at all, return {"confidence": 0.0, "rows": []}.
- Do not invent values you cannot actually infer from the data. If uncertain about a cell, use "" and lower the confidence score accordingly.
- Do not include a header row in "rows" - only data rows.
- Respond with ONLY the JSON object above. No prose, no markdown code fences, no commentary before or after it.
- This may be a partial excerpt of a larger table (rows before/after this batch may exist elsewhere) - map only the rows shown; do not add or invent rows to compensate.

Raw rows (as a JSON array of arrays, one inner array per source row):
`;

function assertGroqConfigured() {
  if (!isConfigured()) {
    const err = new Error(
      "This bank's export format isn't recognized, and AI-assisted fallback requires GROQ_API_KEY, which is not set. " +
        "Add GROQ_API_KEY to backend/.env to enable AI-assisted parsing for unrecognized formats."
    );
    err.code = "AI_FALLBACK_NOT_CONFIGURED";
    err.expose = true; // crafted, user-actionable message -- no raw internals in it
    throw err;
  }
}

async function reinterpretChunkViaAI(chunk) {
  const body = {
    model: GROQ_FALLBACK_MODEL,
    temperature: 0,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: FALLBACK_PROMPT + JSON.stringify(chunk),
      },
    ],
  };

  let data;
  try {
    data = await callGroqChatCompletion(body);
  } catch (e) {
    // Intentionally NOT exposed -- e.message may embed a raw API response
    // body/status from groqClient, which shouldn't reach the browser.
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

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const err = new Error("AI fallback returned output that was not valid JSON.");
    err.code = "AI_FALLBACK_API_ERROR";
    throw err;
  }

  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
  return { rows, confidence };
}

async function reinterpretChunkWithSplitting(chunk) {
  try {
    return await reinterpretChunkViaAI(chunk);
  } catch (e) {
    if (chunk.length > MIN_SPLIT_CHUNK_SIZE && isTokenExhaustionError(e.message)) {
      const mid = Math.ceil(chunk.length / 2);
      const first = await reinterpretChunkWithSplitting(chunk.slice(0, mid));
      await sleep(INTER_CHUNK_DELAY_MS);
      const second = await reinterpretChunkWithSplitting(chunk.slice(mid));
      return {
        rows: [...first.rows, ...second.rows],
        confidence: Math.min(first.confidence, second.confidence),
      };
    }
    throw e;
  }
}

async function reinterpretRowsViaAI(rows) {
  assertGroqConfigured();

  const truncated = rows.length > MAX_ROWS_SENT;
  const sample = truncated ? rows.slice(0, MAX_ROWS_SENT) : rows;

  const chunks = [];
  for (let i = 0; i < sample.length; i += ROWS_PER_CHUNK) {
    chunks.push(sample.slice(i, i + ROWS_PER_CHUNK));
  }

  const allMappedRows = [];
  const confidences = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(INTER_CHUNK_DELAY_MS);
    const { rows: mappedRows, confidence } = await reinterpretChunkWithSplitting(chunks[i]);
    allMappedRows.push(...mappedRows);
    confidences.push(confidence);
  }

  if (allMappedRows.length === 0) {
    const err = new Error(
      "AI fallback ran but could not confidently locate a transaction table in this file either. " +
        "This bank's export format genuinely isn't supported yet."
    );
    err.code = "AI_FALLBACK_NO_ROWS";
    err.expose = true; // crafted, user-actionable message -- no raw internals in it
    throw err;
  }

  const overallConfidence = confidences.length > 0 ? Math.min(...confidences) : 0.5;

  const result = [TARGET_HEADERS, ...allMappedRows];
  result.aiFallbackUsed = true;
  result.aiFallbackConfidence = overallConfidence;
  result.aiFallbackTruncated = truncated;
  return result;
}

module.exports = { reinterpretRowsViaAI };