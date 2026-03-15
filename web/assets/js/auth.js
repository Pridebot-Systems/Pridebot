const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const jwt = require("jsonwebtoken");
const config = require("../../../src/environment.js");

const JWT_SECRET = process.env.JWT_SECRET || "pridebot-jwt-fallback-secret";
const COOKIE_DOMAIN = config.isBeta ? undefined : ".pridebot.xyz";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

function configureDiscordAuth() {
  passport.use(
    new DiscordStrategy(
      {
        clientID: config.clientId,
        clientSecret: config.clientSecret,
        callbackURL: config.callbackURL,
        scope: ["identify"],
      },
      (accessToken, refreshToken, profile, done) => {
        return done(null, {
          id: profile.id,
          username: profile.username,
          avatar: profile.avatar,
        });
      }
    )
  );
}

function generateToken(id, username, avatar) {
  return jwt.sign({ id, username, avatar }, JWT_SECRET, { expiresIn: "7d" });
}

function verifyUserToken(req, res, next) {
  const token =
    req.cookies?.pridebot_token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.username = decoded.username;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function setupAuthRoutes(app) {
  app.get("/auth/discord", (req, res, next) => {
    const redirectTo = req.query.redirect || req.headers.referer || "/";
    res.cookie("pridebot_auth_redirect", redirectTo, {
      maxAge: 5 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      domain: COOKIE_DOMAIN,
    });
    passport.authenticate("discord")(req, res, next);
  });

  app.get(
    "/auth/callback",
    passport.authenticate("discord", { failureRedirect: "/" }),
    (req, res) => {
      const { id, username, avatar } = req.user;
      const token = generateToken(id, username, avatar);

      res.cookie("pridebot_token", token, {
        maxAge: COOKIE_MAX_AGE,
        httpOnly: false, // JS needs to read it for the navbar
        secure: true,
        sameSite: "lax",
        domain: COOKIE_DOMAIN,
      });

      const redirect = req.cookies?.pridebot_auth_redirect || "/";
      res.clearCookie("pridebot_auth_redirect", { domain: COOKIE_DOMAIN });
      res.redirect(redirect);
    }
  );

  app.get("/auth/logout", (req, res) => {
    res.clearCookie("pridebot_token", { domain: COOKIE_DOMAIN });
    const redirect = req.query.redirect || req.headers.referer || "/";
    req.logout(() => {
      res.redirect(redirect);
    });
  });

  app.get("/auth/me", (req, res) => {
    const token = req.cookies?.pridebot_token;
    if (!token) return res.status(401).json({ error: "Not logged in" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      res.json({
        id: decoded.id,
        username: decoded.username,
        avatar: decoded.avatar,
      });
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });
}

module.exports = {
  configureDiscordAuth,
  generateToken,
  verifyUserToken,
  setupAuthRoutes,
  passport,
};

const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const jwt = require('jsonwebtoken');
require('dotenv').config();
const config = require("../../../src/environment");

function configureDiscordAuth() {
  passport.use(new DiscordStrategy({
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      callbackURL: config.callbackURL,
      scope: ['identify', 'guilds']
    },
    (accessToken, refreshToken, profile, done) => {
      return done(null, profile);
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });
}

function verifyUserToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}


function generateToken(userId, username) {
  return jwt.sign(
    { userId, username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

module.exports = {
  configureDiscordAuth,
  verifyUserToken,
  generateToken,
  passport
};
