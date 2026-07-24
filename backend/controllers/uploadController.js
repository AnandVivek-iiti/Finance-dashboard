const path = require("path");
const fs = require("fs");

const Statement = require("../models/Statement");
const Transaction = require("../models/Transaction");
const ParseError = require("../models/ParseError");
const CategoryOverride = require("../models/CategoryOverride");

const { readXlsToRows } = require("../parsers/xlsParser");
const { readPdfToRows } = require("../parsers/pdfParser");
const { normalizeTable } = require("../parsers/tableParser");
const { reinterpretRowsViaAI } = require("../services/aiFallbackParser");

const PASSWORD_CODES = ["PASSWORD_REQUIRED", "INVALID_PASSWORD"];

async function loadOverridesMap(userId) {
  const overrides = await CategoryOverride.listForUser(userId);
  const map = new Map();
  for (const o of overrides) {
    map.set(o.normalizedRemarks, { category: o.category, merchantOrSource: o.merchantOrSource });
  }
  return map;
}

async function checkContinuity(userId, accountNumber, periodStart, openingBalancePaise, filename) {
  if (!accountNumber || openingBalancePaise === null) return null;

  const previous = await Statement.findLatestBefore(userId, accountNumber, periodStart);
  if (!previous) return null;
  if (previous.closingBalancePaise === null) return null;

  if (previous.closingBalancePaise !== openingBalancePaise) {
    return {
      warning: true,
      message: `This statement's opening balance (₹${(openingBalancePaise / 100).toFixed(2)}) does not match the closing balance of the previous statement "${previous.filename}" (₹${(previous.closingBalancePaise / 100).toFixed(2)}). There may be a missing statement, a gap in dates, or an overlapping/duplicate upload.`,
      previousStatementId: previous._id,
    };
  }

  return {
    warning: false,
    message: `Balances and dates continue cleanly between "${previous.filename}" and "${filename}".`,
    previousStatementId: previous._id,
  };
}

async function handleUpload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Expected field name 'statement'." });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  const ext = path.extname(originalName).toLowerCase();
  const password = req.body && req.body.password ? String(req.body.password) : null;
  const userId = req.userId;

  try {
    let rows;
    if (ext === ".xls" || ext === ".xlsx") {
      rows = await readXlsToRows(filePath, password);
    } else if (ext === ".pdf") {
      rows = await readPdfToRows(filePath, password);
    } else {
      const err = new Error(`Unsupported file type "${ext}". Upload a .xls, .xlsx, or .pdf bank statement.`);
      err.expose = true;
      throw err;
    }

    const overridesMap = await loadOverridesMap(userId);
    let result = normalizeTable(rows, overridesMap);
    let aiFallback = null;
    let preAiDiagnostics = result.diagnostics || null;

    const needsAiFallback = result.error || (result.transactions && result.transactions.length === 0);

    if (needsAiFallback && process.env.GROQ_API_KEY) {
      let aiRows;
      try {
        aiRows = await reinterpretRowsViaAI(rows);
      } catch (aiErr) {
        console.error(`[upload] AI table fallback failed for user ${userId}:`, aiErr.stack || aiErr.message);
        aiRows = null;
      }

      if (aiRows) {
        aiFallback = { used: true, confidence: aiRows.aiFallbackConfidence, truncated: aiRows.aiFallbackTruncated };
        result = normalizeTable(aiRows, overridesMap);
      }
    }

    if (result.error) {
      const err = new Error(result.error);
      err.expose = true;
      err.diagnostics = preAiDiagnostics;
      throw err;
    }

    const {
      metadata,
      transactions,
      parseErrors,
      openingBalancePaise,
      closingBalancePaise,
      bankProfileId,
      headerConfidence,
    } = result;

    if (transactions.length === 0) {
      const errorCounts = {};
      for (const pe of parseErrors) errorCounts[pe.errorType] = (errorCounts[pe.errorType] || 0) + 1;
      console.error(
        `[upload] zero transactions for user ${userId} (bankProfile=${bankProfileId}, aiFallback=${!!aiFallback}). ` +
          `Parse error breakdown: ${JSON.stringify(errorCounts)}. Sample rows: ${JSON.stringify(parseErrors.slice(0, 3))}`
      );
      const err = new Error("No valid transactions could be parsed from this file. See parse errors for details.");
      err.expose = true;
      err.diagnostics = preAiDiagnostics;
      throw err;
    }

    const continuityWarning = await checkContinuity(
      userId,
      metadata.accountNumber,
      metadata.periodStart,
      openingBalancePaise,
      originalName
    );

    const statement = await Statement.create({
      userId,
      filename: originalName,
      status: "ready",
      bankProfile: bankProfileId,
      accountNumber: metadata.accountNumber,
      accountHolderName: metadata.accountHolderName,
      branchName: metadata.branchName,
      ifscCode: metadata.ifscCode,
      periodStart: metadata.periodStart,
      periodEnd: metadata.periodEnd,
      openingBalancePaise,
      closingBalancePaise,
      transactionCount: transactions.length,
      parseErrorCount: parseErrors.length,
      continuityWarning: continuityWarning || null,
    });

    await Transaction.insertMany(transactions.map((t) => ({ ...t, userId, statementId: statement._id })));

    if (parseErrors.length > 0) {
      await ParseError.insertMany(parseErrors.map((e) => ({ ...e, userId, statementId: statement._id })));
    }

    res.status(201).json({
      statementId: statement._id,
      status: "ready",
      transactionCount: transactions.length,
      parseErrorCount: parseErrors.length,
      continuityWarning,

      ocrUsed: rows.ocrUsed || false,
      ocrConfidence: rows.ocrUsed ? rows.ocrConfidence : null,
      aiFallbackUsed: aiFallback ? aiFallback.used : false,
      aiFallbackConfidence: aiFallback ? aiFallback.confidence : null,
      aiFallbackTruncated: aiFallback ? aiFallback.truncated : false,

      headerConfidence: headerConfidence != null ? headerConfidence : null,
    });
  } catch (err) {
    console.error(`[upload] failed for user ${userId}:`, err.stack || err.message);

    if (PASSWORD_CODES.includes(err.code)) {
      return res.status(401).json({ error: err.message, code: err.code });
    }
    if (err.expose) {
      return res.status(422).json({ error: err.message, code: err.code || null, diagnostics: err.diagnostics || null });
    }
    res.status(500).json({
      error: "We couldn't process this file. Please check that it's a valid bank statement and try again.",
    });
  } finally {
    fs.unlink(filePath, () => {});
  }
}

module.exports = { handleUpload };