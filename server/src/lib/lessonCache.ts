/**
 * Lesson cache invalidation hook (D-06, SEC-04 defense-in-depth).
 *
 * Phase 1 ships this as a no-op so callers in upload.ts (POST handler) and
 * lessons.ts (DELETE handler) can wire the invalidation contract NOW. Phase 2
 * DATA-06 replaces the body with a real module-level cache clear + 60s TTL
 * fallback for multi-instance deploys. The signature MUST NOT change between
 * phases — callers will not be touched again.
 *
 * Why: Without this stub, the SEC-04 prompt-injection scrub is defeated by
 * cached pre-scrub lesson content during the Phase 1 → Phase 2 window.
 */
export function invalidateLessons(): void {
  // no-op: Phase 2 DATA-06 replaces with cache.clear() + TTL reset
}
