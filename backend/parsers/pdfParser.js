const { execFile } = require("child_process");
const path = require("path");
const { resolvePythonBin } = require("./pythonRuntime");

const SCRIPT_PATH = path.join(__dirname, "..", "scripts", "pdf_extract.py");

function readPdfToRows(filePath, password = null) {
  return new Promise((resolve, reject) => {
    let pythonBin;
    try {
      pythonBin = resolvePythonBin();
    } catch (e) {
      return reject(e);
    }
    execFile(
      pythonBin,
      [SCRIPT_PATH, filePath, ...(password ? [password] : [])],
      { maxBuffer: 1024 * 1024 * 50 },
      (err, stdout, stderr) => {
        if (err) {
          let parsedErr;
          try {
            parsedErr = JSON.parse(stdout);
          } catch (_) {
          }
          if (parsedErr && parsedErr.error) {
            const e = new Error(parsedErr.error);
            if (parsedErr.passwordRequired) {
              e.code = parsedErr.wrongPassword ? "INVALID_PASSWORD" : "PASSWORD_REQUIRED";
            }
            return reject(e);
          }
          return reject(new Error(`PDF extraction process failed: ${stderr || err.message}`));
        }
        let parsed;
        try {
          parsed = JSON.parse(stdout);
        } catch (e) {
          return reject(new Error(`PDF extraction returned invalid output: ${stdout.slice(0, 300)}`));
        }
        if (parsed && parsed.error) {
          const e = new Error(parsed.error);
          if (parsed.passwordRequired) {
            e.code = parsed.wrongPassword ? "INVALID_PASSWORD" : "PASSWORD_REQUIRED";
          }
          return reject(e);
        }
        resolve(parsed);
      }
    );
  });
}

module.exports = { readPdfToRows };