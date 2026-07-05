const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { resolvePythonBin } = require("./pythonRuntime");

const DECRYPT_SCRIPT = path.join(__dirname, "..", "scripts", "decrypt_office.py");

function checkAndDecrypt(filePath, password) {
  return new Promise((resolve, reject) => {
    let pythonBin;
    try {
      pythonBin = resolvePythonBin();
    } catch (e) {
      return reject(e);
    }
    execFile(
      pythonBin,
      [DECRYPT_SCRIPT, filePath, ...(password ? [password] : [])],
      { maxBuffer: 1024 * 1024 * 50 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`Password check process failed: ${stderr || err.message}`));
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error(`Password check returned invalid output: ${stdout.slice(0, 300)}`));
        }
      }
    );
  });
}


async function readXlsToRows(filePath, password = null) {
  const result = await checkAndDecrypt(filePath, password);

  if (result.error) {
    const err = new Error(
      {
        PASSWORD_REQUIRED: "This file is password protected. Enter the password to continue.",
        INVALID_PASSWORD: "That password didn't work. Try again.",
        MISSING_DEPENDENCY:
          "The server is missing a required tool to open password-protected Excel files (msoffcrypto-tool). See backend/README.md.",
        UNREADABLE_FILE: "This file could not be read. It may be corrupted or not a real Excel file.",
      }[result.error] || result.detail || "Failed to open this Excel file."
    );
    err.code = result.error;
    throw err;
  }

  const readPath = result.encrypted ? result.decryptedPath : filePath;

  try {
    const workbook = XLSX.readFile(readPath, { cellDates: false, raw: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
    return rows;
  } finally {
    if (result.encrypted && fs.existsSync(result.decryptedPath)) {
      fs.unlink(result.decryptedPath, () => {});
    }
  }
}

module.exports = { readXlsToRows };