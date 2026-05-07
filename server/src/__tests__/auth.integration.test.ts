import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";

// Set ADMIN_API_TOKEN before any module that reads it at import time.
// auth.ts reads process.env.ADMIN_API_TOKEN at module-load, so we use vi.stubEnv
// to guarantee env-set runs first.
const TEST_TOKEN = "test-admin-token-32hex-abcdef0123456789abcdef0123456789ab";

beforeAll(() => {
  vi.stubEnv("ADMIN_API_TOKEN", TEST_TOKEN);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

// Build a stub app that mounts requireAdmin on the four admin routes and
// leaves the two learner routes open. This isolates the middleware behavior
// from the real route handlers (which need a Prisma mock).
async function buildApp() {
  // Use dynamic import so vi.stubEnv runs before module load.
  const { requireAdmin } = await import("../middleware/auth");
  const app = express();
  app.use(express.json());

  // Admin-gated routes (stubs return 200 to confirm middleware allowed through)
  app.post("/api/upload", requireAdmin, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.delete("/api/lessons/:id", requireAdmin, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get("/api/analytics", requireAdmin, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post("/api/cleanup", requireAdmin, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get("/api/admin/session", requireAdmin, (_req, res) => {
    res.status(200).json({ authenticated: true });
  });

  // Open learner routes (no requireAdmin — confirms mount discrimination)
  app.post("/api/chat", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post("/api/rating", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  return app;
}

describe("requireAdmin middleware (SEC-01)", () => {
  describe("rejects requests without valid token", () => {
    it("POST /api/upload without Authorization header → 401", async () => {
      const app = await buildApp();
      const res = await request(app).post("/api/upload").send({});
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    });

    it("DELETE /api/lessons/:id without Authorization header → 401", async () => {
      const app = await buildApp();
      const res = await request(app).delete("/api/lessons/abc123");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    });

    it("GET /api/analytics without Authorization header → 401", async () => {
      const app = await buildApp();
      const res = await request(app).get("/api/analytics");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    });

    it("POST /api/cleanup without Authorization header → 401", async () => {
      const app = await buildApp();
      const res = await request(app).post("/api/cleanup").send({});
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    });

    it("GET /api/admin/session without Authorization header → 401", async () => {
      const app = await buildApp();
      const res = await request(app).get("/api/admin/session");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    });

    it("POST /api/upload with wrong Bearer token → 401", async () => {
      const app = await buildApp();
      const res = await request(app)
        .post("/api/upload")
        .set("Authorization", "Bearer this-is-not-the-correct-token-1234567890")
        .send({});
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    });

    it("POST /api/upload with malformed Authorization header (no Bearer prefix) → 401", async () => {
      const app = await buildApp();
      const res = await request(app)
        .post("/api/upload")
        .set("Authorization", TEST_TOKEN) // missing "Bearer " prefix
        .send({});
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    });
  });

  describe("allows requests with correct Bearer token on all admin routes", () => {
    it("POST /api/upload with correct token → 200", async () => {
      const app = await buildApp();
      const res = await request(app)
        .post("/api/upload")
        .set("Authorization", `Bearer ${TEST_TOKEN}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it("DELETE /api/lessons/:id with correct token → 200", async () => {
      const app = await buildApp();
      const res = await request(app)
        .delete("/api/lessons/abc123")
        .set("Authorization", `Bearer ${TEST_TOKEN}`);
      expect(res.status).toBe(200);
    });

    it("GET /api/analytics with correct token → 200", async () => {
      const app = await buildApp();
      const res = await request(app)
        .get("/api/analytics")
        .set("Authorization", `Bearer ${TEST_TOKEN}`);
      expect(res.status).toBe(200);
    });

    it("POST /api/cleanup with correct token → 200", async () => {
      const app = await buildApp();
      const res = await request(app)
        .post("/api/cleanup")
        .set("Authorization", `Bearer ${TEST_TOKEN}`)
        .send({});
      expect(res.status).toBe(200);
    });

    it("GET /api/admin/session with correct token → 200", async () => {
      const app = await buildApp();
      const res = await request(app)
        .get("/api/admin/session")
        .set("Authorization", `Bearer ${TEST_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ authenticated: true });
    });
  });

  describe("does not block learner routes (SEC-01: chat + rating stay open)", () => {
    it("POST /api/chat without Authorization → 200 (open)", async () => {
      const app = await buildApp();
      const res = await request(app).post("/api/chat").send({ message: "hello" });
      expect(res.status).toBe(200);
    });

    it("POST /api/rating without Authorization → 200 (open)", async () => {
      const app = await buildApp();
      const res = await request(app).post("/api/rating").send({ messageId: "x", value: "thumbs_up" });
      expect(res.status).toBe(200);
    });
  });
});

describe("requireAdmin middleware (SEC-01) — env-unset edge case", () => {
  it("returns 401 even with valid-looking token when ADMIN_API_TOKEN is empty", async () => {
    // Stub env to empty string for this test only
    vi.stubEnv("ADMIN_API_TOKEN", "");

    // Need fresh import to re-read the env (auth.ts reads at module load).
    // vitest's vi.resetModules + dynamic import gives us a fresh module instance.
    vi.resetModules();
    const { requireAdmin: freshRequireAdmin } = await import("../middleware/auth");

    const app = express();
    app.use(express.json());
    app.post("/api/upload", freshRequireAdmin, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const res = await request(app)
      .post("/api/upload")
      .set("Authorization", "Bearer some-valid-looking-token")
      .send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });

    // Restore for subsequent tests
    vi.stubEnv("ADMIN_API_TOKEN", TEST_TOKEN);
    vi.resetModules();
  });
});
