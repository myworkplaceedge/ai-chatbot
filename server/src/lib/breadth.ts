/**
 * Prompt breadth classification — issue #35 (progressive disclosure).
 *
 * When a learner opens with a broad / ambiguous prompt ("How do I set
 * boundaries?", "Tell me about feedback", "Help with difficult
 * conversations") the coach should NOT dump the full lesson. Instead
 * it should ask ONE clarifying follow-up so the next response can be
 * targeted to the learner's actual situation.
 *
 * Anti-interrogation safeguard: this classifier only labels the prompt
 * as broad — the chat route is responsible for ensuring we ask a
 * clarifying question at most once per session (gated on prior assistant
 * turn count). That way we never end up in a five-question chain.
 *
 * Heuristic-only by design (matches the style of `complexity.ts`) — no
 * model call, no extra latency.
 */

export type PromptBreadth = "broad" | "specific";

export type BreadthResult = {
  breadth: PromptBreadth;
  /** Numeric score: positive tilts broad, negative tilts specific. */
  score: number;
  /** Reason tags so this can be tested and logged. */
  signals: string[];
};

/**
 * Phrases that strongly suggest the learner has not yet narrowed scope.
 * They're recognizable "open the topic" shapes rather than scenario
 * descriptions.
 */
const BROAD_OPENERS = [
  "how do i set",
  "how do i give",
  "how do i handle",
  "how do i approach",
  "how do i deal with",
  "how do i communicate",
  "how do i talk",
  "how do i say no",
  "how should i set",
  "how should i give",
  "how should i handle",
  "how should i approach",
  "how should i deal with",
  "how should i communicate",
  "how should i talk",
  "how can i set",
  "how can i give",
  "how can i handle",
  "how can i approach",
  "how can i deal with",
  "how can i communicate",
  "how can i talk",
  "tell me about",
  "tell me more about",
  "talk to me about",
  "help me with",
  "help with",
  "advice on",
  "advice for",
  "advice about",
  "tips for",
  "tips on",
  "tips about",
  "what about",
];

/**
 * Topic words that on their own are too broad to coach against without
 * more context (which lesson, which situation, which person, etc.).
 */
const BROAD_TOPIC_WORDS = [
  "boundaries",
  "boundary",
  "feedback",
  "communication",
  "conversation",
  "conversations",
  "conflict",
  "conflicts",
  "deadlines",
  "deadline",
  "expectations",
  "listening",
  "interruptions",
  "pushback",
  "ownership",
  "alignment",
  "trust",
  "respect",
  "tone",
  "difficult conversation",
  "difficult conversations",
  "hard conversation",
  "hard conversations",
];

/**
 * Definitional openers — these signal a quick lookup ("what is X")
 * rather than a broad open-the-topic ask. Even if the prompt mentions
 * a broad topic word, we should answer directly rather than
 * interrogate the learner about what they meant by "feedback".
 */
const DEFINITIONAL_OPENERS = [
  "what is",
  "what's",
  "what does",
  "what are",
  "define",
  "definition of",
  "meaning of",
  "explain",
  "can you explain",
  "can you list",
];

/**
 * Markers that the prompt already contains a concrete situation —
 * if any of these are present we should skip the clarifying step
 * and go straight to coaching.
 */
const SPECIFIC_SCENARIO_MARKERS = [
  /\bmy (manager|boss|coworker|colleague|teammate|team|coworkers|colleagues|report|reports|direct report)\b/,
  /\byesterday\b/,
  /\blast week\b/,
  /\bthis morning\b/,
  /\btoday\b/,
  /\bsaid\b/,
  /\btold me\b/,
  /\bemailed\b/,
  /\bsent me\b/,
  /\bwe were\b/,
  /\bthey were\b/,
  /\bshe said\b/,
  /\bhe said\b/,
  /\bthey said\b/,
];

/**
 * Length thresholds. Long prompts almost always carry enough context
 * to coach without a clarifying step.
 */
const WORDS_BROAD_MAX = 14;
const WORDS_DEFINITELY_SPECIFIC = 30;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function startsWithBroadOpener(messageLower: string): string | null {
  for (const opener of BROAD_OPENERS) {
    if (messageLower.startsWith(opener)) return opener;
    // Allow a leading "so " / "okay " / "hey " / "hi " courtesy preamble.
    if (
      messageLower.startsWith(`so ${opener}`) ||
      messageLower.startsWith(`okay ${opener}`) ||
      messageLower.startsWith(`ok ${opener}`) ||
      messageLower.startsWith(`hey ${opener}`) ||
      messageLower.startsWith(`hi ${opener}`)
    ) {
      return opener;
    }
  }
  return null;
}

function containsBroadTopic(messageLower: string): string | null {
  for (const topic of BROAD_TOPIC_WORDS) {
    // Word-boundary check for the single-word topics; substring for the
    // multi-word ones (which already contain spaces).
    if (topic.includes(" ")) {
      if (messageLower.includes(topic)) return topic;
    } else {
      const re = new RegExp(`\\b${topic}\\b`);
      if (re.test(messageLower)) return topic;
    }
  }
  return null;
}

function hasSpecificScenarioMarker(messageLower: string): boolean {
  return SPECIFIC_SCENARIO_MARKERS.some((re) => re.test(messageLower));
}

function startsWithDefinitionalOpener(messageLower: string): boolean {
  return DEFINITIONAL_OPENERS.some((opener) => messageLower.startsWith(opener));
}

/**
 * Classify a learner message as broad (needs a clarifying question
 * before the coach commits to a full answer) or specific (enough
 * context to coach directly).
 */
export function classifyBreadth(message: string): BreadthResult {
  const text = (message ?? "").trim();
  const lower = text.toLowerCase();
  const signals: string[] = [];
  let score = 0;

  if (!text) {
    return { breadth: "specific", score: 0, signals: ["empty"] };
  }

  const wordCount = countWords(text);

  // Long prompts almost always have enough context.
  if (wordCount >= WORDS_DEFINITELY_SPECIFIC) {
    return { breadth: "specific", score: -3, signals: ["long_message"] };
  }

  // A concrete scenario kills the broad classification regardless of
  // surface shape — "How do I handle [my coworker who said X yesterday]"
  // is already specific enough to coach.
  if (hasSpecificScenarioMarker(lower)) {
    return { breadth: "specific", score: -2, signals: ["specific_scenario_marker"] };
  }

  // Definitional questions ("what is X?", "define Y") are targeted
  // lookups, not broad scope-the-topic asks. Answer them directly.
  if (startsWithDefinitionalOpener(lower)) {
    return { breadth: "specific", score: -1, signals: ["definitional_lookup"] };
  }

  const opener = startsWithBroadOpener(lower);
  if (opener) {
    score += 2;
    signals.push(`broad_opener:${opener}`);
  }

  const topic = containsBroadTopic(lower);
  if (topic) {
    score += 1;
    signals.push(`broad_topic:${topic}`);
  }

  if (wordCount <= WORDS_BROAD_MAX) {
    score += 1;
    signals.push("short_message");
  }

  // Question-shape with no concrete object also tilts broad.
  if (lower.endsWith("?") && wordCount <= WORDS_BROAD_MAX) {
    score += 1;
    signals.push("short_question");
  }

  // We require BOTH a broad opener / shape AND either a broad topic or
  // shortness — score >= 3 means at minimum opener + (topic OR short).
  // This keeps things like "what is an I-statement?" out of the broad
  // bucket (no broad opener, no broad topic).
  const breadth: PromptBreadth = score >= 3 ? "broad" : "specific";
  return { breadth, score, signals };
}

/**
 * Returns a clarification-first directive to inject into the Gemini
 * system instruction. Only the chat route should decide *when* to
 * include this — see issue #35 for the anti-interrogation rule.
 */
export function buildClarifyDirective(): string {
  return `PROGRESSIVE DISCLOSURE — the learner's current message is BROAD or AMBIGUOUS and you have not yet clarified scope this session. Do NOT deliver the full three-beat coaching answer yet. Instead:
1. Briefly acknowledge the topic in one short sentence (no validation paragraph, no teaching, no application step).
2. Ask exactly ONE focused clarifying question that helps the learner narrow down to their actual situation. Offer 2–3 plausible angles in the question itself so the learner can pick one quickly (e.g. "are you thinking work boundaries with a manager, personal boundaries with family, or something else?"). Never list more than three angles.
3. Stop. Do not provide the full lesson, do not stack multiple questions, and do not include a [FOLLOW-UP] line — the clarifying question IS the follow-up for this turn.

Once the learner replies with more context, your next response will switch back to the normal coaching shape and deliver a targeted answer. You will not be asked to clarify again this session.`;
}
