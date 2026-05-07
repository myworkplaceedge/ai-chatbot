import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const state = vi.hoisted(() => ({
  lessons: [] as { id: string; name: string; content: string; createdAt: Date }[],
}));

vi.mock("../lib/db", () => ({
  prisma: {
    lesson: {
      findMany: vi.fn(async () =>
        state.lessons.map(({ id, name, createdAt }) => ({ id, name, createdAt })),
      ),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return state.lessons.find((l) => l.id === where.id) ?? null;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const idx = state.lessons.findIndex((l) => l.id === where.id);
        if (idx === -1) {
          throw Object.assign(new Error("Not found"), { code: "P2025" });
        }
        const [removed] = state.lessons.splice(idx, 1);
        return removed;
      }),
    },
  },
}));

const GLOSSARY_LESSON = {
  id: "lesson_with_vocab",
  name: "Boundary Language.docx",
  createdAt: new Date(),
  content: `
Lesson body content here.

Glossary:

● Bandwidth: The time and energy someone has available.
● Stretched too thin: Having too many tasks to do well.
● Offline: Outside this meeting or conversation.

References

Some references here.
`,
};

const PLAIN_LESSON = {
  id: "lesson_no_vocab",
  name: "Plain Lesson.docx",
  createdAt: new Date(),
  content: "Some lesson content with no glossary section at all.",
};

async function buildApp() {
  const { lessonsRouter } = await import("../routes/lessons");
  const app = express();
  app.use(express.json());
  app.use("/api/lessons", lessonsRouter);
  return app;
}

describe("lessons vocabulary endpoints", () => {
  beforeEach(() => {
    state.lessons = [GLOSSARY_LESSON, PLAIN_LESSON];
  });

  describe("GET /api/lessons/:id/vocabulary", () => {
    it("reports hasVocabulary=true for a lesson with a glossary", async () => {
      const app = await buildApp();
      const res = await request(app).get(`/api/lessons/${GLOSSARY_LESSON.id}/vocabulary`);
      expect(res.status).toBe(200);
      expect(res.body.hasVocabulary).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(3);
      expect(res.body.lessonName).toBe("Boundary Language.docx");
    });

    it("reports hasVocabulary=false for a lesson without a glossary", async () => {
      const app = await buildApp();
      const res = await request(app).get(`/api/lessons/${PLAIN_LESSON.id}/vocabulary`);
      expect(res.status).toBe(200);
      expect(res.body.hasVocabulary).toBe(false);
      expect(res.body.count).toBe(0);
    });

    it("returns 404 when the lesson does not exist", async () => {
      const app = await buildApp();
      const res = await request(app).get("/api/lessons/nope/vocabulary");
      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/lessons/:id/vocabulary.pdf", () => {
    it("returns a PDF buffer for a lesson with a glossary", async () => {
      const app = await buildApp();
      const res = await request(app).get(`/api/lessons/${GLOSSARY_LESSON.id}/vocabulary.pdf`);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/pdf/);
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.headers["content-disposition"]).toContain("vocabulary.pdf");
      // PDF magic header.
      const body = res.body as Buffer;
      expect(body.subarray(0, 4).toString("ascii")).toBe("%PDF");
      expect(body.length).toBeGreaterThan(500);
    });

    it("returns 404 when the lesson has no glossary", async () => {
      const app = await buildApp();
      const res = await request(app).get(`/api/lessons/${PLAIN_LESSON.id}/vocabulary.pdf`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/no vocabulary/i);
    });

    it("returns 404 when the lesson does not exist", async () => {
      const app = await buildApp();
      const res = await request(app).get("/api/lessons/missing/vocabulary.pdf");
      expect(res.status).toBe(404);
    });

    it("sanitizes filenames containing path separators", async () => {
      state.lessons = [
        {
          id: "weird",
          name: "../../etc/passwd.docx",
          createdAt: new Date(),
          content: "Glossary:\n\n● Term: definition.\n",
        },
      ];
      const app = await buildApp();
      const res = await request(app).get("/api/lessons/weird/vocabulary.pdf");
      expect(res.status).toBe(200);
      const cd = res.headers["content-disposition"];
      expect(cd).not.toContain("/");
      expect(cd).toContain("vocabulary.pdf");
    });
  });
});
