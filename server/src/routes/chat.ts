import { Router } from "express";
import { prisma } from "../lib/db";
import {
  detectIntent,
  intentResultForClientIntent,
  isClientSelectableIntent,
  selectLessonContext,
} from "../lib/intent";
import { getChatResponse } from "../lib/gemini";
import { checkEscalation } from "../lib/escalation";
import { filterMessage } from "../lib/contentFilter";
import { stripPII } from "../lib/privacy";
import { classifyComplexity } from "../lib/complexity";
import { classifyBreadth } from "../lib/breadth";
import {
  buildHandoutIntent,
  buildHandoutMarker,
  decodeHandouts,
  extractTitleFromHandoutIntent,
  pickHandoutToSuggest,
  type Handout,
} from "../lib/handouts";

export const chatRouter = Router();

async function resolveSession(sessionId?: string) {
  if (!sessionId) {
    return prisma.session.create({ data: {} });
  }
  const existing = await prisma.session.findUnique({ where: { id: sessionId } });
  if (existing) {
    return existing;
  }
  return prisma.session.create({ data: { id: sessionId } });
}

chatRouter.post("/", async (req, res) => {
  try {
    const body = req.body as { sessionId?: string; message?: string; intent?: string; mode?: string };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const session = await resolveSession(body.sessionId);

    // Content filter check — run before persisting so blocked/PII content is never stored
    const filter = filterMessage(message);
    if (filter.blocked) {
      const blockedMsg =
        "I'm here to help with workplace communication topics. I can't respond to that kind of message.";
      const stored = await prisma.message.create({
        data: { sessionId: session.id, role: "assistant", content: blockedMsg },
      });
      await prisma.intentLog.create({
        data: { sessionId: session.id, intent: `filtered:${filter.reason}`, docsSelected: "" },
      });
      res.json({ sessionId: session.id, response: blockedMsg, messageId: stored.id, escalated: false });
      return;
    }

    const priorMessages = await prisma.message.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true },
    });

    // Strip PII before storing user message
    const sanitizedMessage = stripPII(message);
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: sanitizedMessage,
      },
    });

    const allLessons = await prisma.lesson.findMany({
      select: { name: true, content: true, handouts: true },
      orderBy: { createdAt: "asc" },
    });
    // The intent helpers only need name + content; pass a stripped view so we
    // don't widen their input type.
    const lessonsForIntent = allLessons.map(({ name, content }) => ({ name, content }));
    const { intent, matchedLessons } =
      typeof body.intent === "string" && isClientSelectableIntent(body.intent)
        ? intentResultForClientIntent(body.intent, message, lessonsForIntent)
        : detectIntent(message, lessonsForIntent);
    const lessonContext = selectLessonContext(intent, lessonsForIntent, matchedLessons);

    const conversationHistory = priorMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const escalation = checkEscalation(message);

    // Determine chat mode
    const chatMode = body.mode === "roleplay" ? "roleplay" : body.mode === "roleplay_feedback" ? "roleplay_feedback" : "coach";

    // Classify prompt complexity so the coach response can be calibrated.
    // Only matters in coach mode — roleplay modes have their own shape.
    const { complexity } = classifyComplexity(message);

    // Classify prompt breadth for progressive disclosure (issue #35).
    // The clarifying-question step only fires on the very first
    // assistant turn of a session — after that we default to coaching
    // so we never end up in a five-question interrogation chain.
    const { breadth } = classifyBreadth(message);
    const priorAssistantTurns = priorMessages.filter((m) => m.role === "assistant").length;

    const assistantText = await getChatResponse(
      conversationHistory,
      lessonContext,
      message,
      chatMode,
      complexity,
      { breadth, priorAssistantTurns },
    );

    const baseResponse = escalation.escalated
      ? `${assistantText}\n\n---\n\n${escalation.message}`
      : assistantText;

    // Contextual handout suggestion (issue #37). Only in the default coach
    // flow — roleplay/feedback have their own response shape, and escalated
    // turns shouldn't redirect the learner to a worksheet.
    const suggestedHandout =
      chatMode === "coach" && !escalation.escalated
        ? await pickContextualHandout(session.id, lessonContext, allLessons)
        : null;

    const finalResponse = suggestedHandout
      ? `${baseResponse}\n${buildHandoutMarker(suggestedHandout)}`
      : baseResponse;

    const stored = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: finalResponse,
      },
    });

    const docsSelected = matchedLessons.join(", ");
    await prisma.intentLog.create({
      data: {
        sessionId: session.id,
        intent: escalation.escalated ? `escalated:${escalation.category ?? "unknown"}` : intent,
        docsSelected,
      },
    });

    // Log the handout suggestion as a separate IntentLog row so future turns
    // in the same session can dedup against it.
    if (suggestedHandout) {
      await prisma.intentLog.create({
        data: {
          sessionId: session.id,
          intent: buildHandoutIntent(suggestedHandout),
          docsSelected,
        },
      });
    }

    res.json({
      sessionId: session.id,
      response: finalResponse,
      messageId: stored.id,
      escalated: escalation.escalated,
    });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : "Chat failed";
    res.status(500).json({ error: messageText });
  }
});

/**
 * Pick a single handout to surface for this turn, or `null` if there's
 * nothing relevant or the learner already saw every candidate this session.
 *
 * The pool is drawn from the lessons that are actually in the model's
 * context for this turn — that's the same relevance signal the chat path
 * already uses, so the suggestion will track the topic the learner is on.
 * If lesson-context is empty (e.g. general coaching with no lessons) we fall
 * back to the full library so we still get a chance to surface a handout.
 */
async function pickContextualHandout(
  sessionId: string,
  lessonContext: { name: string; content: string }[],
  allLessons: { name: string; content: string; handouts: string | null }[],
): Promise<Handout | null> {
  const contextNames = new Set(lessonContext.map((l) => l.name));
  const pool = lessonContext.length > 0
    ? allLessons.filter((l) => contextNames.has(l.name))
    : allLessons;

  // Flatten + dedup candidates across the relevant lessons. Earlier lessons
  // (older createdAt) win on ties, matching the deterministic ordering used
  // throughout the chat path.
  const candidates: Handout[] = [];
  const seenTitles = new Set<string>();
  for (const lesson of pool) {
    for (const h of decodeHandouts(lesson.handouts)) {
      const key = h.title.toLowerCase();
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      candidates.push(h);
    }
  }
  if (candidates.length === 0) return null;

  // Pull all prior handout suggestions in this session — that's the dedup set.
  const priorLogs = await prisma.intentLog.findMany({
    where: { sessionId },
    select: { intent: true },
  });
  const alreadySuggested: string[] = [];
  for (const log of priorLogs) {
    const title = extractTitleFromHandoutIntent(log.intent);
    if (title) alreadySuggested.push(title);
  }

  return pickHandoutToSuggest(candidates, alreadySuggested);
}
