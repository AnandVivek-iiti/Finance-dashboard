const { spawnSync } = require("child_process");

const CANDIDATES = [process.env.PYTHON_BIN, "python3", "python", "py"].filter(Boolean);

let resolved = null; // cached after first successful probe

function resolvePythonBin() {
  if (resolved) return resolved;

  for (const candidate of CANDIDATES) {
    try {
      const result = spawnSync(candidate, ["--version"], { encoding: "utf-8" });

      if (!result.error && result.status === 0) {
        resolved = candidate;
        return resolved;
      }
    } catch (_) {
    }
  }

  throw new Error(
    "Could not find a working Python interpreter. Tried: " +
      CANDIDATES.join(", ") +
      ". Set PYTHON_BIN in backend/.env to the exact command that works on your machine (e.g. PYTHON_BIN=python)."
  );
}

module.exports = { resolvePythonBin };