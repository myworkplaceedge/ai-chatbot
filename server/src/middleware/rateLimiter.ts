import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import type { Request } from "express";

/**
 * globalRateLimiter — broad guard before body parsing (D-03 mount order #1).
 * Drops floods before express.json() does any work.
 * 200 requests/min/IP across the whole API. Tune based on Railway logs after week 1.
 *
 * D-03 locked response shape: { error, retryAfter?, requestId }. The functional
 * `message` form lets us mint a fresh per-response requestId via randomUUID()
 * without depending on Phase 2's full AsyncLocalStorage request-ID middleware.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: false, // CVE-2026-30827 fix; do not collapse IPv4-mapped IPv6 onto one bucket
  message: () => ({ error: "Too many requests", requestId: randomUUID() }),
});

/**
 * chatLimiter — IP-based limit on /api/chat (D-02: 30/min/IP).
 * Mounted at route level AFTER globalRateLimiter and BEFORE chatSessionLimiter.
 */
export const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: false,
  message: () => ({ error: "Rate limit exceeded", retryAfter: 60, requestId: randomUUID() }),
});

/**
 * chatSessionLimiter — session-keyed limit on /api/chat (D-02: 100/min/session).
 *
 * CRITICAL: This middleware reads `req.body.sessionId`, so it MUST be mounted
 * AFTER express.json() in the canonical middleware order. Mount at the route
 * level (not globally) — see 01-04 plan for index.ts mount order.
 *
 * Falls back to req.ip when no sessionId is sent (e.g., the very first request
 * in a new session before the server mints one). This means the first chat
 * message in any session is double-counted by both chatLimiter (IP) and
 * chatSessionLimiter (IP-fallback) — acceptable.
 */
export const chatSessionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const sessionId = (req.body as { sessionId?: string } | undefined)?.sessionId;
    if (sessionId) return sessionId;
    return req.ip ? ipKeyGenerator(req.ip, false) : "unknown";
  },
  message: () => ({ error: "Rate limit exceeded", retryAfter: 60, requestId: randomUUID() }),
});

/**
 * uploadLimiter — IP-based limit on /api/upload (D-02: 5/min/IP).
 * Mounted at route level BEFORE requireAdmin (rate-drop the flood before token compare).
 * No session bucket — admin-only route already has auth gate.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: false,
  message: () => ({ error: "Upload rate limit exceeded", retryAfter: 60, requestId: randomUUID() }),
});
