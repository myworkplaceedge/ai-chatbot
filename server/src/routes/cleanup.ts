import { Router } from "express";
import { prisma } from "../lib/db";
import { cleanExpiredSessions } from "../lib/privacy";

export const cleanupRouter = Router();

/**
 * POST /api/cleanup — admin-gated session retention.
 *
 * Mounted with `requireAdmin` at the app level in index.ts. Deletes sessions
 * older than 30 days plus their cascade-related rows (Message, IntentLog,
 * Rating). Phase 2 DATA-02 wraps this in a batched transaction.
 */
cleanupRouter.post("/", async (_req, res) => {
  try {
    const deleted = await cleanExpiredSessions(prisma);
    res.json({ deleted });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Cleanup failed";
    res.status(500).json({ error: msg });
  }
});
