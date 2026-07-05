const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const COOKIE_NAME = "token";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches JWT expiry

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: COOKIE_MAX_AGE_MS,
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

async function googleLogin(req, res) {
  const { idToken } = req.body;
  if (!idToken || typeof idToken !== "string") {
    return res.status(400).json({ error: "idToken is required." });
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: "Invalid Google token." });
  }

  if (!payload || !payload.sub || !payload.email) {
    return res.status(401).json({ error: "Invalid Google token." });
  }

  let user = await User.findOne({ googleId: payload.sub });
  if (!user) {
    // A Google account's email is verified by Google, so it's safe to key
    // find-or-create on it as a fallback in case googleId ever changes.
    user = await User.findOne({ email: payload.email });
  }

  if (!user) {
    user = await User.create({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || "",
      picture: payload.picture || "",
    });
  } else {
    user.googleId = payload.sub;
    user.name = payload.name || user.name;
    user.picture = payload.picture || user.picture;
    await user.save();
  }

  const token = signToken(user._id.toString());
  res.cookie(COOKIE_NAME, token, cookieOptions());

  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
  });
}

async function getMe(req, res) {
  const user = await User.findById(req.userId).lean();
  if (!user) return res.status(401).json({ error: "Not signed in." });

  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    },
  });
}

async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ loggedOut: true });
}

module.exports = { googleLogin, getMe, logout };
