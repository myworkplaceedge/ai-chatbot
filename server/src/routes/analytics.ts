import { Router } from "express";
import { prisma } from "../lib/db";

export const analyticsRouter = Router();

analyticsRouter.get("/", async (_req, res) => {
  try {
    // Intent distribution
    const intentLogs = await prisma.intentLog.findMany({ select: { intent: true } });
    const intentDistribution: Record<string, number> = {};
    for (const log of intentLogs) {
      intentDistribution[log.intent] = (intentDistribution[log.intent] || 0) + 1;
    }

    // Lesson popularity from docsSelected
    const docsLogs = await prisma.intentLog.findMany({
      select: { docsSelected: true },
      where: { docsSelected: { not: "" } },
    });
    const lessonPopularity: Record<string, number> = {};
    for (const log of docsLogs) {
      const docs = log.docsSelected.split(",").map((s) => s.trim()).filter(Boolean);
      for (const doc of docs) {
        lessonPopularity[doc] = (lessonPopularity[doc] || 0) + 1;
      }
    }

    // Total sessions
    const totalSessions = await prisma.session.count();

    // Average messages per session
    const totalMessages = await prisma.message.count();
    const avgMessagesPerSession = totalSessions > 0 ? Math.round((totalMessages / totalSessions) * 10) / 10 : 0;

    // Rating summary
    const ratings = await prisma.rating.findMany({ select: { value: true } });
    const ratingSummary = { thumbs_up: 0, thumbs_down: 0 };
    for (const r of ratings) {
      if (r.value === "thumbs_up") ratingSummary.thumbs_up++;
      else if (r.value === "thumbs_down") ratingSummary.thumbs_down++;
    }

    res.json({
      intentDistribution,
      lessonPopularity,
      totalSessions,
      avgMessagesPerSession,
      ratingSummary,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analytics failed";
    res.status(500).json({ error: msg });
  }
});
