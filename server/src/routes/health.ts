import { Router } from "express";

export const healthRouter = Router();

/**
 * GET /api/health — uptime monitor endpoint (D-05 SEC-03).
 *
 * Returns { status, commit, uptime }. NO auth gate, NO rate limit, NO CORS
 * check (mounted before all middleware in index.ts). Uptime monitors
 * (Railway, Vercel, UptimeRobot) send no-Origin requests; this route MUST
 * always reach them, regardless of CORS production deny rules.
 *
 * commit comes from process.env.GIT_COMMIT_SHA (Railway sets this at build);
 * falls back to "unknown" when unset (local dev, missed CI config).
 */
healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    commit: process.env.GIT_COMMIT_SHA ?? "unknown",
    uptime: process.uptime(),
  });
});
