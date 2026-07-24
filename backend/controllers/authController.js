const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const COOKIE_NAME = "token";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: COOKIE_MAX_AGE_MS,
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

function toPublicUser(user) {
  return { id: user._id, email: user.email, name: user.name, picture: user.picture };
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

  let user = await User.findByGoogleId(payload.sub);
  if (!user) {
    user = await User.findByEmail(payload.email);
  }

  if (!user) {
    user = await User.create({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || "",
      picture: payload.picture || "",
    });
  } else {
    user = await User.updateGoogleProfile(user._id, {
      googleId: payload.sub,
      name: payload.name || user.name,
      picture: payload.picture || user.picture,
    });
  }

  const token = signToken(user._id.toString());
  res.cookie(COOKIE_NAME, token, cookieOptions());

  res.json({ user: toPublicUser(user) });
}

async function getMe(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: "Not signed in." });

  res.json({ user: toPublicUser(user) });
}

async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
  res.json({ loggedOut: true });
}

module.exports = { googleLogin, getMe, logout };