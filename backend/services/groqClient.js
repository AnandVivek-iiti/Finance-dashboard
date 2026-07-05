
const GROQ_OCR_MODEL = process.env.GROQ_OCR_MODEL || "qwen/qwen3.6-27b";
const GROQ_FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL || "openai/gpt-oss-120b";

function getApiKeys() {
  const raw = process.env.GROQ_API_KEY || "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function isConfigured() {
  return getApiKeys().length > 0;
}

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const RETRYABLE_STATUS = new Set([500, 503]);
const MAX_ATTEMPTS_PER_KEY = 2;
const BASE_BACKOFF_MS = 1000;
const MAX_429_RETRIES = 6;
const DEFAULT_429_WAIT_MS = 2000;
const MAX_TOTAL_429_WAIT_MS = 30000; // give up rather than hang indefinitely on one call

function parseRetryAfterMs(message) {
  const match = /try again in ([\d.]+)\s*s/i.exec(message || "");
  if (!match) return null;
  const seconds = parseFloat(match[1]);
  if (Number.isNaN(seconds)) return null;
  return Math.ceil(seconds * 1000) + 250; // small buffer so we land just after the window resets
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Single HTTP call. Returns a plain result descriptor rather than throwing,
// so callers can decide what to do with each status code.
async function doFetch(key, body) {
  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (response.ok) {
    return { ok: true, data: await response.json() };
  }
  const text = await response.text().catch(() => "");
  return { ok: false, status: response.status, text };
}

async function attemptWithKey(key, keyIndex, keyCount, body) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_KEY; attempt++) {
    let result;
    try {
      result = await doFetch(key, body);
    } catch (networkErr) {
      lastError = new Error(`Groq request failed (network error): ${networkErr.message}`);
      lastError.code = "GROQ_NETWORK_ERROR";
      if (attempt < MAX_ATTEMPTS_PER_KEY) await sleep(BASE_BACKOFF_MS * attempt);
      continue;
    }

    // Absorb 429s here, outside the outer attempt budget, since they're
    // expected and short-lived rather than a failure of this key/request.
    let total429WaitMs = 0;
    let retries429 = 0;
    let networkErrorDuring429Wait = false;

    while (result.status === 429) {
      lastError = new Error(
        `Groq rate limit reached on key ${keyIndex + 1}/${keyCount} (429): ${result.text.slice(0, 300)}`
      );
      lastError.code = "GROQ_RATE_LIMITED";

      const waitMs = parseRetryAfterMs(result.text) || DEFAULT_429_WAIT_MS;
      if (retries429 >= MAX_429_RETRIES || total429WaitMs + waitMs > MAX_TOTAL_429_WAIT_MS) {
        return { ok: false, error: lastError };
      }
      total429WaitMs += waitMs;
      retries429 += 1;
      await sleep(waitMs);

      try {
        result = await doFetch(key, body);
      } catch (networkErr) {
        lastError = new Error(`Groq request failed (network error): ${networkErr.message}`);
        lastError.code = "GROQ_NETWORK_ERROR";
        networkErrorDuring429Wait = true;
        break;
      }
    }

    if (networkErrorDuring429Wait) {
      if (attempt < MAX_ATTEMPTS_PER_KEY) await sleep(BASE_BACKOFF_MS * attempt);
      continue;
    }

    if (result.ok) {
      return { ok: true, data: result.data };
    }

    // result.status is a non-429, non-ok status at this point.
    if (RETRYABLE_STATUS.has(result.status) && attempt < MAX_ATTEMPTS_PER_KEY) {
      lastError = new Error(`Groq request failed (${result.status}): ${result.text.slice(0, 300)}`);
      lastError.code = "GROQ_API_ERROR";
      await sleep(BASE_BACKOFF_MS * attempt);
      continue;
    }

    lastError = new Error(`Groq request failed (${result.status}): ${result.text.slice(0, 300)}`);
    lastError.code = "GROQ_API_ERROR";
    break;
  }

  return { ok: false, error: lastError };
}
async function callGroqChatCompletion(body) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    const err = new Error("GROQ_API_KEY is not set.");
    err.code = "GROQ_NOT_CONFIGURED";
    throw err;
  }

  let lastError;

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const outcome = await attemptWithKey(keys[keyIndex], keyIndex, keys.length, body);
    if (outcome.ok) return outcome.data;
    lastError = outcome.error;
  }

  const err = new Error(
    `All ${keys.length} Groq API key(s) failed. Last error: ${lastError ? lastError.message : "unknown"}`
  );
  err.code =
    lastError && lastError.code === "GROQ_RATE_LIMITED" ? "GROQ_ALL_KEYS_RATE_LIMITED" : "GROQ_ALL_KEYS_FAILED";
  throw err;
}

module.exports = {
  callGroqChatCompletion,
  isConfigured,
  getApiKeys,
  GROQ_OCR_MODEL,
  GROQ_FALLBACK_MODEL,
};