import "./env";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { uploadRouter } from "./routes/upload";
import { lessonsRouter } from "./routes/lessons";
import { chatRouter } from "./routes/chat";
import { ratingRouter } from "./routes/rating";
import { analyticsRouter } from "./routes/analytics";
import { cleanupRouter } from "./routes/cleanup";
import { healthRouter } from "./routes/health";
import { ipDebugRouter } from "./routes/ipDebug";
import { adminRouter } from "./routes/admin";

import { requireAdmin } from "./middleware/auth";
import {
  globalRateLimiter,
  chatLimiter,
  chatSessionLimiter,
  uploadLimiter,
} from "./middleware/rateLimiter";

// D-14: catch async errors that escape Express's default handler.
// uncaughtException exits the process; unhandledRejection logs only.
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

const app = express();
const isProd = process.env.NODE_ENV === "production";

// trust proxy: 1 — required for express-rate-limit to read the real client IP
// when behind Railway's reverse proxy. NEVER set to `true` (allows IP spoofing
// via X-Forwarded-For header).
app.set("trust proxy", 1);

// ============================================================================
// helmet — security headers on every response
//
// D-07: Explicit frameAncestors. Helmet's default `frame-ancestors 'self'`
// silently kills the LearnWorlds iframe embed. Pre-Phase 1 Gate #1 requires
// the actual LearnWorlds school subdomain; ship with `https://*.learnworlds.com`
// wildcard until that gate is closed.
//
// xFrameOptions: false removes the bogus `X-Frame-Options: ALLOWALL` we ship
// today (non-standard value, browsers ignore). frame-ancestors supersedes
// X-Frame-Options in every modern browser.
// ============================================================================
const VERCEL_PROD_URL = process.env.VERCEL_PROD_URL ?? "";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind requires unsafe-inline
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: isProd
          ? ["https://*.learnworlds.com", VERCEL_PROD_URL].filter(Boolean)
          : ["'self'", "http://localhost:5173", "http://localhost:*"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    xFrameOptions: false,
  }),
);

// ============================================================================
// /api/health — mounted BEFORE cors so no-Origin uptime monitor requests
// bypass the production CORS deny rule (D-05, RESEARCH.md Pitfall 3).
// No auth, no rate limit.
// ============================================================================
app.use("/api/health", healthRouter);

// ============================================================================
// CORS — exact-origin allowlist (D-04). NO wildcard *.vercel.app.
//
// dev origins: localhost:5173 + 127.0.0.1:5173 (always allowed)
// prod origins: ALLOWED_ORIGINS env var (comma-separated, e.g.
//   "https://workplace-edge.vercel.app,https://chat.workplaceedge.com")
//
// Production no-origin requests are denied (uptime monitors use /api/health
// which is mounted above). Dev no-origin requests are allowed for ergonomics.
// ============================================================================
function extraAllowedOrigins(): Set<string> {
  const raw = process.env.ALLOWED_ORIGINS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function isOriginAllowed(origin: string): boolean {
  const extras = extraAllowedOrigins();
  if (extras.has(origin)) return true;
  const devOrigins = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
  if (devOrigins.has(origin)) return true;
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        if (isProd) {
          callback(null, false); // production deny no-origin (health bypassed above)
        } else {
          callback(null, true); // dev allow no-origin (curl, etc.)
        }
        return;
      }
      callback(null, isOriginAllowed(origin));
    },
    credentials: false,
  }),
);

// ============================================================================
// globalRateLimiter — broad guard before body parse.
// Drops floods before express.json() does any work. 200/min/IP.
// ============================================================================
app.use(globalRateLimiter);

// express.json AFTER rate limit. Body cap 50kb to prevent JSON bomb.
// Larger payloads (e.g., uploaded .docx files) go through multer in upload.ts,
// not this body parser.
app.use(express.json({ limit: "50kb" }));

// ============================================================================
// Route registration with per-route limiters and auth gates.
// ============================================================================

// /api/chat — open learner route, dual rate limit (D-02):
//   chatLimiter:        30/min/IP  (route level, after globalRateLimiter)
//   chatSessionLimiter: 100/min/session (route level, AFTER express.json so
//                       req.body.sessionId is available — RESEARCH.md Pitfall 1)
app.use("/api/chat", chatLimiter, chatSessionLimiter, chatRouter);

// /api/upload — admin route. uploadLimiter THEN requireAdmin so a flood of
// unauthenticated requests is rate-dropped before the token comparison.
app.use("/api/upload", uploadLimiter, requireAdmin, uploadRouter);

// /api/lessons — GET is open (learner can list lessons). DELETE has
// requireAdmin applied INSIDE lessonsRouter (per-route mount in lessons.ts).
app.use("/api/lessons", lessonsRouter);

// /api/admin — lightweight admin session validation route.
app.use("/api/admin", requireAdmin, adminRouter);

// /api/analytics — admin route. requireAdmin at app level.
app.use("/api/analytics", requireAdmin, analyticsRouter);

// /api/cleanup — admin route. requireAdmin at app level.
// Now uses cleanupRouter from routes/cleanup.ts (extracted from inline handler).
app.use("/api/cleanup", requireAdmin, cleanupRouter);

// /api/rating — open learner route. No auth, but globalRateLimiter still applies.
app.use("/api/rating", ratingRouter);

// /api/ip — DEV-ONLY debug endpoint for Pre-Phase 1 Gate #2 verification.
// (RESEARCH.md Open Question #2 resolution.)
if (!isProd) {
  app.use("/api/ip", ipDebugRouter);
}

// ============================================================================
// Listen
// ============================================================================
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
