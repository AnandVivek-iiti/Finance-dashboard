const fs = require("fs");
const path = require("path");

const ZIP_SIGNATURE = { bytes: [0x50, 0x4b, 0x03, 0x04] }; // ZIP local file header (unencrypted xlsx)
const OLE2_SIGNATURE = { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }; // OLE2 compound file

const SIGNATURES = {
  ".pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // "%PDF"
  // xlsx is a zip when unencrypted, but Office wraps a password-protected
  // xlsx in an OLE2/CFB container instead -- accept both.
  ".xlsx": [ZIP_SIGNATURE, OLE2_SIGNATURE],
  ".xls": [OLE2_SIGNATURE], // always OLE2, encrypted or not
};

function matchesSignature(buffer, signature) {
  return signature.bytes.every((byte, i) => buffer[i] === byte);
}

function validateFileSignature(req, res, next) {
  if (!req.file) return next(); // let the controller's own "no file" check handle this

  const ext = path.extname(req.file.originalname).toLowerCase();
  const signatures = SIGNATURES[ext];

  if (!signatures) {
    return fs.unlink(req.file.path, () =>
      res.status(400).json({ error: `Unsupported file type "${ext}".` })
    );
  }

  let handle;
  try {
    handle = fs.openSync(req.file.path, "r");
    const buffer = Buffer.alloc(8);
    fs.readSync(handle, buffer, 0, 8, 0);

    const ok = signatures.some((sig) => matchesSignature(buffer, sig));
    if (!ok) {
      return fs.unlink(req.file.path, () =>
        res.status(400).json({
          error: `The uploaded file's content doesn't match its "${ext}" extension. It may be corrupted, renamed, or not a real ${ext} file.`,
          code: "FILE_SIGNATURE_MISMATCH",
        })
      );
    }
  } catch (err) {
    console.error("[validateFileSignature] failed:", err.stack || err.message);
    return fs.unlink(req.file.path, () =>
      res.status(400).json({ error: "Could not read the uploaded file to verify its type." })
    );
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
  }

  next();
}

module.exports = validateFileSignature;