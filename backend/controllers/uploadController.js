const path = require("path");
const fs = require("fs");

const Statement = require("../models/Statement");
const Transaction = require("../models/Transaction");
const ParseError = require("../models/ParseError");
const CategoryOverride = require("../models/CategoryOverride");

const { readXlsToRows } = require("../parsers/xlsParser");
const { readPdfToRows } = require("../parsers/pdfParser");
const { normalizeTable } = require("../parsers/tableParser");

const PASSWORD_CODES = ["PASSWORD_REQUIRED", "INVALID_PASSWORD"];

async function loadOverridesMap(userId) {
  const overrides = await CategoryOverride.find({ userId }).lean();
  const map = new Map();
  for (const o of overrides) {
    map.set(o.normalizedRemarks, { category: o.category, merchantOrSource: o.merchantOrSource });
  }
  return map;
}


async function checkContinuity(userId, accountNumber, periodStart, openingBalancePaise, filename) {
  if (!accountNumber || openingBalancePaise === null) return null;

  const previous = await Statement.findOne({
    userId,
    accountNumber,
    status: "ready",
    periodEnd: { $ne: null, $lt: periodStart || new Date(8640000000000000) },
  })
    .sort({ periodEnd: -1 })
    .lean();

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
      throw new Error(`Unsupported file type "${ext}". Upload a .xls, .xlsx, or .pdf bank statement.`);
    }

    const overridesMap = await loadOverridesMap(userId);
    const result = normalizeTable(rows, overridesMap);

    if (result.error) {
      throw new Error(result.error);
    }

    const { metadata, transactions, parseErrors, openingBalancePaise, closingBalancePaise, bankProfileId } = result;

    if (transactions.length === 0) {
      throw new Error("No valid transactions could be parsed from this file. See parse errors for details.");
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

    await Transaction.insertMany(
      transactions.map((t) => ({ ...t, userId, statementId: statement._id }))
    );

    if (parseErrors.length > 0) {
      await ParseError.insertMany(parseErrors.map((e) => ({ ...e, userId, statementId: statement._id })));
    }

    res.status(201).json({
      statementId: statement._id,
      status: "ready",
      transactionCount: transactions.length,
      parseErrorCount: parseErrors.length,
      continuityWarning,
    });
  } catch (err) {
    const status = PASSWORD_CODES.includes(err.code) ? 401 : 422;
    res.status(status).json({ error: err.message, code: err.code || null });
  } finally {
    fs.unlink(filePath, () => {});
  }
}

module.exports = { handleUpload };
