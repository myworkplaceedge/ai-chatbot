/**
 * Prompt complexity classification.
 *
 * The AI Lesson Coach normally answers in a structured three-beat
 * (validate → teach → apply) format. That treatment is great for
 * substantive coaching questions but feels heavy when the learner
 * asks something quick (e.g. "what's an I-statement?", "thanks!",
 * "did I do that right?"). This module classifies the learner's
 * message so the response depth can be calibrated.
 *
 * Design choice: heuristic-only — we never ask the learner
 * "quick answer or go deeper?" because the issue (#36) explicitly
 * calls out that asking on every message annoys users.
 */

export type PromptComplexity = "simple" | "complex";

export type ComplexityResult = {
  complexity: PromptComplexity;
  /** Numeric score used for classification — higher = more complex. */
  score: number;
  /** Human-readable reasons that influenced the score (useful for tests/logs). */
  signals: string[];
};

const SIMPLE_GREETINGS = [
  "hi",
  "hello",
  "hey",
  "thanks",
  "thank you",
  "ty",
  "ok",
  "okay",
  "got it",
  "cool",
  "great",
  "sure",
  "yes",
  "no",
  "yep",
  "nope",
];

/**
 * Phrases that strongly suggest the learner wants a deep, coached answer
 * (a real situation, multi-part problem, or asking how to navigate
 * something nuanced).
 */
const COMPLEX_PHRASES = [
  "how do i handle",
  "how should i handle",
  "how do i approach",
  "how should i approach",
  "what should i say",
  "what would you say",
  "i'm not sure how",
  "i don't know how",
  "i'm struggling",
  "help me think through",
  "walk me through",
  "i'm in a situation",
  "the situation is",
  "context:",
  "background:",
];

/**
 * Words that often signal a quick definitional / lookup question rather
 * than a coaching scenario.
 */
const DEFINITIONAL_OPENERS = [
  "what is",
  "what's",
  "what does",
  "define",
  "definition of",
  "meaning of",
  "is it",
  "are these",
  "can you list",
];

const WORDS_SIMPLE_MAX = 12;
const WORDS_COMPLEX_MIN = 30;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : (text.trim() ? 1 : 0);
}

function countConjunctions(text: string): number {
  // Counts coordinating conjunctions/connectors that often signal
  // multi-part questions.
  const lower = ` ${text.toLowerCase()} `;
  const tokens = [" and ", " but ", " also ", " however ", " plus ", " then ", " so "];
  return tokens.reduce((sum, t) => sum + (lower.split(t).length - 1), 0);
}

function isJustGreeting(messageLower: string): boolean {
  const cleaned = messageLower.trim().replace(/[!?.]+$/g, "").trim();
  if (!cleaned) return false;
  return SIMPLE_GREETINGS.includes(cleaned);
}

function startsWithDefinitional(messageLower: string): boolean {
  return DEFINITIONAL_OPENERS.some((opener) => messageLower.startsWith(opener));
}

function matchesAnyComplexPhrase(messageLower: string): string[] {
  return COMPLEX_PHRASES.filter((phrase) => messageLower.includes(phrase));
}

/**
 * Classify a learner message as simple or complex.
 *
 * Simple → short, direct answer (no rigid 3-beat structure).
 * Complex → the full validate → teach → apply coaching treatment.
 */
export function classifyComplexity(message: string): ComplexityResult {
  const text = (message ?? "").trim();
  const lower = text.toLowerCase();
  const signals: string[] = [];
  let score = 0;

  if (!text) {
    return { complexity: "simple", score: 0, signals: ["empty"] };
  }

  // Hard short-circuits for obvious simple cases.
  if (isJustGreeting(lower)) {
    return { complexity: "simple", score: -3, signals: ["greeting_only"] };
  }

  const wordCount = countWords(text);
  if (wordCount <= 3) {
    return { complexity: "simple", score: -2, signals: ["very_short"] };
  }

  // Length-based scoring.
  if (wordCount <= WORDS_SIMPLE_MAX) {
    score -= 1;
    signals.push("short_message");
  } else if (wordCount >= WORDS_COMPLEX_MIN) {
    score += 2;
    signals.push("long_message");
  }

  // Multiple sentences usually means a layered question / scenario.
  const sentenceCount = countSentences(text);
  if (sentenceCount >= 2) {
    score += 1;
    signals.push("multi_sentence");
  }
  if (sentenceCount >= 3) {
    score += 1;
    signals.push("many_sentences");
  }

  // Multi-part questions joined by conjunctions.
  const conjunctions = countConjunctions(text);
  if (conjunctions >= 2) {
    score += 1;
    signals.push("multi_part");
  }

  // Definitional openers tilt simple.
  if (startsWithDefinitional(lower) && wordCount <= WORDS_SIMPLE_MAX) {
    score -= 2;
    signals.push("definitional_lookup");
  }

  // Coaching-scenario phrases tilt complex.
  const matchedPhrases = matchesAnyComplexPhrase(lower);
  if (matchedPhrases.length > 0) {
    score += 2;
    signals.push(`coaching_phrase:${matchedPhrases[0]}`);
  }

  // First-person scenario language ("my coworker said…", "my manager…")
  // combined with reasonable length tilts complex.
  if (/\bmy (manager|boss|coworker|colleague|teammate|team|coworkers|colleagues)\b/.test(lower) && wordCount > 8) {
    score += 1;
    signals.push("personal_scenario");
  }

  const complexity: PromptComplexity = score >= 1 ? "complex" : "simple";
  return { complexity, score, signals };
}

/**
 * Returns a depth-calibration directive to inject into the Gemini system
 * instruction. Kept separate from `buildSystemInstruction` so it can be
 * unit-tested in isolation and reused by other prompt builders later.
 */
export function buildDepthDirective(complexity: PromptComplexity): string {
  if (complexity === "simple") {
    return `RESPONSE DEPTH — the learner's current message is a SIMPLE prompt (a quick question, definition, acknowledgement, or short check-in). Override the three-beat shape: answer directly in 1–2 short sentences. Skip the validate/teach/apply structure. Do not pad the answer. You may still end with the [FOLLOW-UP] line, but keep it optional and only include it if a natural next step exists.`;
  }
  return `RESPONSE DEPTH — the learner's current message is a COMPLEX prompt (a real situation, multi-part question, or coaching scenario). Use the full three-beat shape (validate → teach → apply) as described in RESPONSE SHAPE. Take the time to be thorough, but stay within the formatting rules.`;
}
