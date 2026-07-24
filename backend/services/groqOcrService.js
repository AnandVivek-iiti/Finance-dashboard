const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { callGroqChatCompletion, isConfigured, GROQ_OCR_MODEL } = require("./groqClient");

const TARGET_HEADERS = ["Date", "Transaction ID", "Withdrawal", "Deposit", "Balance", "Remarks"];

const MAX_COMPLETION_TOKENS = Number(process.env.GROQ_OCR_MAX_TOKENS) || 4000;

const OCR_PROMPT = `You are extracting a transaction table from a scanned bank statement page.

Return ONLY the transactions visible on THIS page, as JSON matching this exact shape:
{
  "confidence": <number 0.0-1.0, your honest confidence that every row was read correctly>,
  "rows": [
    ["<date>", "<transaction id or reference, or empty string>", "<withdrawal amount or empty string>", "<deposit amount or empty string>", "<balance amount or empty string>", "<remarks/narration>"]
  ]
}

Rules:
- One array per transaction row, in the order they appear top to bottom.
- Dates: output as DD/MM/YYYY (convert if the statement uses a different format).
- Amounts: plain numbers only, no currency symbols, no thousands separators (e.g. "1500.00" not "₹1,500.00"). Use an empty string "" if a cell is blank, not "0".
- If the page is rotated or upside down, read it correctly anyway; do not transpose rows/columns.
- If the page has no transaction table at all (e.g. it's a cover page), return {"confidence": 1.0, "rows": []}.
- Do not invent rows or values you cannot actually read. If a single cell is illegible, use "" for that cell rather than guessing, and lower the confidence score accordingly.
- Do not include a header row in "rows" — only data rows.
- Respond with ONLY the JSON object above. No prose, no markdown code fences, no commentary before or after it.`;

function assertGroqConfigured() {
  if (!isConfigured()) {
    const err = new Error(
      "This PDF appears to be scanned (no selectable text), which requires OCR, but GROQ_API_KEY is not set. " +
        "Add GROQ_API_KEY to backend/.env to enable OCR for scanned statements."
    );
    err.code = "OCR_NOT_CONFIGURED";
    err.expose = true;
    throw err;
  }
}
function renderPdfPagesToPng(filePath, password) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-ocr-"));
  const outputPrefix = path.join(tmpDir, "page");

  const args = ["-png", "-r", "200"];
  if (password) args.push("-upw", password);
  args.push(filePath, outputPrefix);

  const result = spawnSync("pdftoppm", args, { maxBuffer: 1024 * 1024 * 200 });

  if (result.error) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const err = new Error(
      "Could not rasterize PDF for OCR: pdftoppm (poppler-utils) is not installed on this server. " +
        "Install it with `apt-get install poppler-utils` (see README Deployment section)."
    );
    err.code = "OCR_RENDER_FAILED";
    err.expose = true;
    throw err;
  }
  if (result.status !== 0) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const stderr = (result.stderr || "").toString();
    const err = new Error(`Could not rasterize PDF for OCR: ${stderr.trim() || "pdftoppm failed"}`);
    err.code = "OCR_RENDER_FAILED";
    throw err;
  }

  const pages = fs
    .readdirSync(tmpDir)
    .filter((f) => f.endsWith(".png"))
    .sort() // pdftoppm zero-pads page numbers by default, so lexical sort == page order
    .map((f) => path.join(tmpDir, f));

  if (pages.length === 0) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const err = new Error("Could not rasterize PDF for OCR: no pages were produced.");
    err.code = "OCR_RENDER_FAILED";
    err.expose = true;
    throw err;
  }

  return { tmpDir, pages };
}

async function ocrOnePage(pngPath) {
  const imageBase64 = fs.readFileSync(pngPath).toString("base64");

  const body = {
    model: GROQ_OCR_MODEL,
    temperature: 0,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: OCR_PROMPT },
          { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } },
        ],
      },
    ],
  };

  let data;
  try {
    data = await callGroqChatCompletion(body);
  } catch (e) {
   const err = new Error(`Groq OCR request failed: ${e.message}`);
    err.code = "OCR_API_ERROR";
    throw err;
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    const err = new Error("Groq OCR returned an empty response for a page.");
    err.code = "OCR_API_ERROR";
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const err = new Error("Groq OCR returned output that was not valid JSON.");
    err.code = "OCR_API_ERROR";
    throw err;
  }

  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
  return { rows, confidence };
}

async function readPdfToRowsViaOcr(filePath, password = null) {
  assertGroqConfigured();

  const { tmpDir, pages } = renderPdfPagesToPng(filePath, password);

  try {
    const perPage = [];
    for (const pngPath of pages) {
      perPage.push(await ocrOnePage(pngPath));
    }

    const allRows = [];
    for (const page of perPage) allRows.push(...page.rows);

    if (allRows.length === 0) {
      const err = new Error(
        "OCR ran successfully but found no transaction rows in this PDF. It may not be a bank statement, or image quality may be too poor to read."
      );
      err.code = "OCR_NO_ROWS";
      err.expose = true;
      throw err;
    }

    const confidences = perPage.map((p) => p.confidence);
    const overallConfidence = Number((Math.min(...confidences) || 0).toFixed(2));

    const result = [TARGET_HEADERS, ...allRows];
    result.ocrUsed = true;
    result.ocrConfidence = overallConfidence;
    result.ocrPageCount = pages.length;
    return result;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { readPdfToRowsViaOcr };