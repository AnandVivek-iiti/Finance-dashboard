const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");

const sanitizeBody = mongoSanitize();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down and try again shortly." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads. Please wait a few minutes before uploading more statements." },
});

function requireXhrHeader(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  if (req.get("X-Requested-With") !== "XMLHttpRequest") {
    return res.status(403).json({ error: "Request rejected: missing required client header." });
  }
  next();
}

function applySecurity(app) {

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );
  app.use(compression());
  app.use(hpp());
  app.use(apiLimiter);
}

module.exports = { applySecurity, authLimiter, uploadLimiter, requireXhrHeader, sanitizeBody };
