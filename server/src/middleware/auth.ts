import { timingSafeEqual, createHash } from "node:crypto";
import type { RequestHandler } from "express";

const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

/**
 * requireAdmin — bearer-token gate for privileged routes (D-11, SEC-01).
 *
 * Verifies `Authorization: Bearer <token>` against `process.env.ADMIN_API_TOKEN`
 * via crypto.timingSafeEqual on sha256-hashed buffers (equal length, prevents
 * length-extension and timing-leak attacks).
 *
 * Returns 401 for both missing-token and wrong-token cases — no 403, no hint
 * about which case fired (per D-11: uniform error shape).
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(ADMIN_TOKEN).digest();
  if (!timingSafeEqual(a, b)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};
