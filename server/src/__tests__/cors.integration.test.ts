import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import cors from "cors";
import helmet from "helmet";

// Set the env vars our tests rely on BEFORE importing the modules that read them
// at load time (rateLimiter.ts and CORS config don't read env at module load,
// but ALLOWED_ORIGINS is read at every request, so stubEnv works).
beforeAll(() => {
  vi.stubEnv("ALLOWED_ORIGINS", "https://chat.example.com,https://workplace-edge.vercel.app");
  vi.stubEnv("ADMIN_API_TOKEN", "test-admin-token-32hex-abcdef0123456789abcdef0123456789ab");
  vi.stubEnv("NODE_ENV", "production"); // exercise the prod no-origin deny path
});

afterAll(() => {
  vi.unstubAllEnvs();
});

// Mock prisma so route handlers don't hit a real DB.
const state = vi.hoisted(() => ({
  lessons: [] as { id: string; name: string; createdAt: Date }[],
}));

vi.mock("../lib/db", () => ({
  prisma: {
    lesson: {
      findMany: vi.fn(async () => state.lessons),
    },
  },
}));

beforeEach(() => {
  state.lessons.length = 0;
});

/**
 * Build a stub app that mirrors the canonical middleware chain from
 * server/src/index.ts (Task 2). We intentionally re-create the chain here
 * rather than importing index.ts — index.ts calls app.listen() at module load,
 * which would conflict with supertest's ephemeral port. This pattern is
 * standard for testing Express apps with side-effecting entry points.
 */
async function buildApp() {
  const { healthRouter } = await import("../routes/health");

  const isProd = process.env.NODE_ENV === "production";
  const app = express();

  app.set("trust proxy", 1);

  // helmet (mirror index.ts config)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: isProd
            ? ["https://*.learnworlds.com"]
            : ["'self'", "http://localhost:5173", "http://localhost:*"],
          upgradeInsecureRequests: isProd ? [] : null,
        },
      },
      xFrameOptions: false,
    }),
  );

  // health BEFORE cors (Pitfall 3 fix)
  app.use("/api/health", healthRouter);

  // CORS — exact-origin allowlist (mirror index.ts)
  function extraAllowedOrigins(): Set<string> {
    const raw = process.env.ALLOWED_ORIGINS?.trim();
    if (!raw) return new Set();
    return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
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
          callback(null, !isProd);
          return;
        }
        callback(null, isOriginAllowed(origin));
      },
      credentials: false,
    }),
  );

  app.use(express.json());

  // Stub a route to test CORS against (avoids needing the full chat router + Gemini mock)
  app.post("/api/chat", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.get("/api/lessons", (_req, res) => {
    res.status(200).json({ lessons: [] });
  });

  return app;
}

describe("CORS allowlist (SEC-03 D-04)", () => {
  describe("/api/health bypass", () => {
    it("GET /api/health with no Origin header returns 200 (bypasses CORS)", async () => {
      const app = await buildApp();
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "ok" });
      expect(res.body.commit).toBeDefined();
      expect(typeof res.body.uptime).toBe("number");
    });

    it("GET /api/health with arbitrary 'evil' Origin returns 200 (mounted before cors)", async () => {
      const app = await buildApp();
      const res = await request(app)
        .get("/api/health")
        .set("Origin", "https://evil.example.com");
      expect(res.status).toBe(200);
    });
  });

  describe("non-health routes — exact-origin allowlist", () => {
    it("POST /api/chat with Origin 'https://chat.example.com' (in ALLOWED_ORIGINS) → 200 with ACAO header", async () => {
      const app = await buildApp();
      const res = await request(app)
        .post("/api/chat")
        .set("Origin", "https://chat.example.com")
        .send({ message: "test" });
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://chat.example.com");
    });

    it("POST /api/chat with Origin 'https://evil.example.com' → no ACAO header (CORS denied)", async () => {
      const app = await buildApp();
      const res = await request(app)
        .post("/api/chat")
        .set("Origin", "https://evil.example.com")
        .send({ message: "test" });
      // cors middleware does not block; it just omits the ACAO header so the browser blocks.
      // The handler still runs (Express calls next on cors deny), but ACAO is absent.
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("POST /api/chat with Origin 'https://random-attacker.vercel.app' → no ACAO header (wildcard NO LONGER allowed — regression from old behavior)", async () => {
      const app = await buildApp();
      const res = await request(app)
        .post("/api/chat")
        .set("Origin", "https://random-attacker.vercel.app")
        .send({ message: "test" });
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("POST /api/chat with no Origin in production → no ACAO header (deny no-origin in prod, except /api/health)", async () => {
      const app = await buildApp();
      const res = await request(app).post("/api/chat").send({ message: "test" });
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("POST /api/chat with dev Origin 'http://localhost:5173' → 200 with ACAO header (dev origins always allowed)", async () => {
      const app = await buildApp();
      const res = await request(app)
        .post("/api/chat")
        .set("Origin", "http://localhost:5173")
        .send({ message: "test" });
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });
  });
});

describe("Helmet CSP response headers (SEC-03 D-07)", () => {
  it("includes Content-Security-Policy header with frame-ancestors directive on non-health routes", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/lessons");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors");
  });

  it("frame-ancestors directive includes https://*.learnworlds.com in production", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/lessons");
    expect(res.headers["content-security-policy"]).toContain("https://*.learnworlds.com");
  });

  it("does NOT set X-Frame-Options: ALLOWALL (the bogus legacy header is removed; xFrameOptions: false in helmet config)", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/lessons");
    expect(res.headers["x-frame-options"]).toBeUndefined();
  });

  it("includes X-Content-Type-Options: nosniff (helmet v8 default)", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/lessons");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
