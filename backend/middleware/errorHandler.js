function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function exposeError(message, status = 400, code = null) {
  const err = new Error(message);
  err.expose = true;
  err.status = status;
  if (code) err.code = code;
  return err;
}

const GENERIC_MESSAGE = "Something went wrong on our end. Please try again.";

function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.originalUrl}:`, err.stack || err.message);

  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid ID." });
  }

  if (err.name === "MulterError") {
    return res.status(400).json({ error: err.message });
  }
  if (err.expose) {
    return res.status(err.status || 400).json({ error: err.message, code: err.code || null });
  }

  res.status(err.status || 500).json({ error: GENERIC_MESSAGE });
}

module.exports = { asyncHandler, errorHandler, exposeError };