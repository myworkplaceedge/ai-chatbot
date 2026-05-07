import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import { extractVocabulary } from "../lib/vocabulary";
import { renderVocabularyPdf } from "../lib/vocabularyPdf";
import { requireAdmin } from "../middleware/auth";
import { invalidateLessons } from "../lib/lessonCache";

export const lessonsRouter = Router();

lessonsRouter.get("/", async (_req, res) => {
  try {
    const lessons = await prisma.lesson.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });
    res.json(lessons);
  } catch {
    res.status(500).json({ error: "Failed to load lessons" });
  }
});

/**
 * GET /api/lessons/:id/vocabulary
 *
 * Returns metadata about whether the lesson has any extractable glossary
 * entries. The frontend uses this to decide whether to expose a download
 * button. Kept cheap: returns counts only, not the entries themselves.
 */
lessonsRouter.get("/:id/vocabulary", async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }
    const entries = extractVocabulary(lesson.content);
    res.json({
      lessonId: lesson.id,
      lessonName: lesson.name,
      count: entries.length,
      hasVocabulary: entries.length > 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to load vocabulary" });
  }
});

/**
 * GET /api/lessons/:id/vocabulary.pdf
 *
 * Generates a PDF of the lesson glossary on demand and streams it to the
 * client. Returns 404 if the lesson exists but has no extractable glossary
 * (so the frontend can avoid offering a useless download).
 */
lessonsRouter.get("/:id/vocabulary.pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = await prisma.lesson.findUnique({ where: { id } });
    if (!lesson) {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }

    const entries = extractVocabulary(lesson.content);
    if (entries.length === 0) {
      res.status(404).json({ error: "No vocabulary found in this lesson" });
      return;
    }

    const pdf = await renderVocabularyPdf({
      lessonName: lesson.name,
      entries,
    });

    const safeName = sanitizeFilename(lesson.name).replace(/\.docx$/i, "");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", pdf.length);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}-vocabulary.pdf"`,
    );
    res.send(pdf);
  } catch {
    res.status(500).json({ error: "Failed to generate vocabulary PDF" });
  }
});

lessonsRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.lesson.delete({ where: { id } });
    // D-06: Invalidate lesson cache so chat requests stop seeing the deleted lesson.
    invalidateLessons();
    res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      res.status(404).json({ error: "Lesson not found" });
      return;
    }
    res.status(500).json({ error: "Failed to delete lesson" });
  }
});

function sanitizeFilename(name: string): string {
  // Strip path separators and characters that are unsafe in HTTP headers.
  return name.replace(/[\\/:*?"<>|\r\n]+/g, "_").slice(0, 120) || "lesson";
}
