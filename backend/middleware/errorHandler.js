
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function errorHandler(err, req, res, next) {
  console.error("[error]", err.message);
  if (err.name === "MulterError" || /Unsupported file type/.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || "Internal server error" });
}

module.exports = { asyncHandler, errorHandler };
