import { Router } from "express";

export const ipDebugRouter = Router();

/**
 * GET /api/ip — debug endpoint for Pre-Phase 1 Gate #2 verification
 * (Railway dual-stack IPv6 confirmation + trust proxy + ipv6Subnet false
 * verification). Returns { ip: req.ip }.
 *
 * Mounted ONLY when NODE_ENV !== 'production' (per RESEARCH.md Open Question
 * #2 resolution). For production gate verification, temporarily flip the
 * NODE_ENV gate in index.ts during a verification window, then revert.
 *
 * Documented in CLAUDE.md as a dev-only endpoint.
 */
ipDebugRouter.get("/", (req, res) => {
  res.status(200).json({ ip: req.ip ?? "unknown" });
});
