import { describe, it, expect } from "vitest";
import {
  VOCABULARY_RULE,
  buildSystemInstruction,
  buildRolePlayInstruction,
  buildRolePlayFeedbackInstruction,
} from "../lib/gemini";

const EMPTY: { name: string; content: string }[] = [];

const SAMPLE_LESSON = {
  name: "Difficult Conversations",
  content:
    "Use the Spark Shift Stretch framework to coach others. The SPARK step opens the conversation, the shift step refocuses, and the Stretch step pushes for growth.",
};

const MULTI_LESSONS = [
  { name: "Lesson A", content: "Active listening is the foundation of trust." },
  { name: "Lesson B", content: "Reflective questions deepen rapport." },
];

const MIXED_LESSONS = [
  { name: "Framework Lesson", content: "Spark, Shift, and Stretch are the three beats." },
  { name: "Plain Lesson", content: "Empathy first." },
];

describe("VOCABULARY_RULE constant", () => {
  it("is a non-empty exported string", () => {
    expect(typeof VOCABULARY_RULE).toBe("string");
    expect(VOCABULARY_RULE.length).toBeGreaterThan(50);
  });

  it("explicitly names Spark, Shift, and Stretch (proper-cased)", () => {
    expect(VOCABULARY_RULE).toContain("Spark");
    expect(VOCABULARY_RULE).toContain("Shift");
    expect(VOCABULARY_RULE).toContain("Stretch");
  });

  it("uses prohibitive language (never/not/must not)", () => {
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/never|not|must/);
  });

  it("addresses casing variants explicitly", () => {
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/casing/);
  });

  it("addresses paraphrase / alternative phrasing", () => {
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/paraphrase/);
  });

  it("instructs the model to handle lesson-quoted occurrences", () => {
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/lesson/);
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/quote|paraphrase/);
  });

  it("anticipates the learner asking about the framework by name", () => {
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/learner asks|asks about|by name/);
  });

  it("identifies the words as internal scaffolding (not learner-facing)", () => {
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/internal|scaffolding/);
  });

  it("starts with an identifiable rule label", () => {
    expect(VOCABULARY_RULE).toMatch(/^VOCABULARY RULE/);
  });
});

describe("VOCABULARY_RULE wiring across the three system instructions", () => {
  it("coach instruction embeds the rule verbatim", () => {
    const out = buildSystemInstruction(EMPTY);
    expect(out).toContain(VOCABULARY_RULE);
  });

  it("roleplay instruction embeds the rule verbatim", () => {
    const out = buildRolePlayInstruction(EMPTY);
    expect(out).toContain(VOCABULARY_RULE);
  });

  it("roleplay-feedback instruction embeds the rule verbatim", () => {
    const out = buildRolePlayFeedbackInstruction(EMPTY);
    expect(out).toContain(VOCABULARY_RULE);
  });

  it("each instruction names all three forbidden words", () => {
    for (const out of [
      buildSystemInstruction(EMPTY),
      buildRolePlayInstruction(EMPTY),
      buildRolePlayFeedbackInstruction(EMPTY),
    ]) {
      expect(out).toContain("Spark");
      expect(out).toContain("Shift");
      expect(out).toContain("Stretch");
    }
  });

  it("each builder embeds the rule exactly once (DRY: no duplicate inlining)", () => {
    const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;
    expect(count(buildSystemInstruction(EMPTY), VOCABULARY_RULE)).toBe(1);
    expect(count(buildRolePlayInstruction(EMPTY), VOCABULARY_RULE)).toBe(1);
    expect(count(buildRolePlayFeedbackInstruction(EMPTY), VOCABULARY_RULE)).toBe(1);
  });
});

describe("buildSystemInstruction (coach mode)", () => {
  it("contains the structural sections expected by the coach prompt", () => {
    const out = buildSystemInstruction(EMPTY);
    expect(out).toContain("AI Lesson Coach");
    expect(out).toContain("RESPONSE SHAPE");
    expect(out).toContain("FORMATTING RULES");
    expect(out).toContain("SCOPE RULES");
    expect(out).toContain("[FOLLOW-UP]");
  });

  it("does NOT label the three beats with framework names", () => {
    const out = buildSystemInstruction(EMPTY);
    expect(out).not.toMatch(/Beat 1: Spark/);
    expect(out).not.toMatch(/Beat 2: Shift/);
    expect(out).not.toMatch(/Beat 3: Stretch/);
  });

  it("places the vocabulary rule before the lesson content block (so suppression applies to the included content)", () => {
    const out = buildSystemInstruction([SAMPLE_LESSON]);
    const ruleIdx = out.indexOf(VOCABULARY_RULE);
    // Sentinel-wrapped: the per-lesson block uses <lesson_content_UUID> (not bare <lesson_content>).
    // Match the sentinel tag prefix which is stable across calls.
    const lessonIdx = out.indexOf("<lesson_content_");
    expect(ruleIdx).toBeGreaterThan(-1);
    expect(lessonIdx).toBeGreaterThan(-1);
    expect(ruleIdx).toBeLessThan(lessonIdx);
  });

  it("falls back to a 'no lessons loaded' message when given an empty array", () => {
    const out = buildSystemInstruction(EMPTY);
    expect(out.toLowerCase()).toMatch(/no lesson|lessons need to be uploaded/);
  });

  it("includes lesson content when provided", () => {
    const out = buildSystemInstruction([SAMPLE_LESSON]);
    expect(out).toContain(SAMPLE_LESSON.name);
    expect(out).toContain(SAMPLE_LESSON.content);
  });

  it("renders multiple lessons separated by a divider", () => {
    const out = buildSystemInstruction(MULTI_LESSONS);
    expect(out).toContain("Lesson A");
    expect(out).toContain("Lesson B");
    expect(out).toContain("---");
  });

  it("still includes the rule even when lesson content itself contains forbidden words", () => {
    const out = buildSystemInstruction([SAMPLE_LESSON]);
    // Lesson DB content is NOT sanitized — verify it leaks through verbatim,
    // and verify the rule sits in the prompt to instruct the model to suppress it.
    expect(out).toContain("Spark Shift Stretch framework");
    expect(out).toContain(VOCABULARY_RULE);
  });

  it("produces a reasonable instruction length for a populated prompt", () => {
    const out = buildSystemInstruction([SAMPLE_LESSON]);
    expect(out.length).toBeGreaterThan(800);
    expect(out.length).toBeLessThan(10000);
  });
});

describe("buildRolePlayInstruction", () => {
  it("contains the role-play structural sections", () => {
    const out = buildRolePlayInstruction(EMPTY);
    expect(out).toContain("role-playing");
    expect(out).toContain("ROLE-PLAY RULES");
  });

  it("places the vocabulary rule before the lesson content section", () => {
    const out = buildRolePlayInstruction([SAMPLE_LESSON]);
    const ruleIdx = out.indexOf(VOCABULARY_RULE);
    // Updated: lesson content section now starts with "Lesson content (" to include
    // the sentinel-wrap prose. Match the stable prefix.
    const lessonIdx = out.indexOf("Lesson content");
    expect(ruleIdx).toBeGreaterThan(-1);
    expect(lessonIdx).toBeGreaterThan(-1);
    expect(ruleIdx).toBeLessThan(lessonIdx);
  });

  it("handles empty lesson list with a fallback", () => {
    const out = buildRolePlayInstruction(EMPTY);
    expect(out.toLowerCase()).toMatch(/no lesson documents loaded/);
  });

  it("preserves the rule when lesson content itself contains the forbidden words", () => {
    const out = buildRolePlayInstruction(MIXED_LESSONS);
    expect(out).toContain("Spark, Shift, and Stretch");
    expect(out).toContain(VOCABULARY_RULE);
  });
});

describe("buildRolePlayFeedbackInstruction", () => {
  it("contains the feedback structural sections", () => {
    const out = buildRolePlayFeedbackInstruction(EMPTY);
    expect(out).toContain("feedback");
    expect(out).toContain("What went well");
    expect(out).toContain("Areas to improve");
    expect(out).toContain("Key takeaway");
    expect(out).toContain("[FOLLOW-UP]");
  });

  it("places the vocabulary rule before the lesson content section", () => {
    const out = buildRolePlayFeedbackInstruction([SAMPLE_LESSON]);
    const ruleIdx = out.indexOf(VOCABULARY_RULE);
    // Updated: lesson content section now starts with "Lesson content (" to include
    // the sentinel-wrap prose. Match the stable prefix.
    const lessonIdx = out.indexOf("Lesson content");
    expect(ruleIdx).toBeGreaterThan(-1);
    expect(lessonIdx).toBeGreaterThan(-1);
    expect(ruleIdx).toBeLessThan(lessonIdx);
  });

  it("includes lesson content blocks for multi-lesson input", () => {
    const out = buildRolePlayFeedbackInstruction(MULTI_LESSONS);
    expect(out).toContain("### Lesson: Lesson A");
    expect(out).toContain("### Lesson: Lesson B");
    expect(out).toContain("---");
  });

  it("preserves the rule even when lesson content contains the forbidden words", () => {
    const out = buildRolePlayFeedbackInstruction(MIXED_LESSONS);
    expect(out).toContain("Spark, Shift, and Stretch");
    expect(out).toContain(VOCABULARY_RULE);
  });
});

describe("cross-mode consistency", () => {
  it("all three modes share the exact same vocabulary rule wording (no drift)", () => {
    const coach = buildSystemInstruction(EMPTY);
    const roleplay = buildRolePlayInstruction(EMPTY);
    const feedback = buildRolePlayFeedbackInstruction(EMPTY);

    // Find the rule in each and confirm it matches the canonical constant.
    expect(coach.includes(VOCABULARY_RULE)).toBe(true);
    expect(roleplay.includes(VOCABULARY_RULE)).toBe(true);
    expect(feedback.includes(VOCABULARY_RULE)).toBe(true);
  });

  it("all three modes pass through lesson content unchanged at the prompt layer (no DB-content sanitization)", () => {
    // The fix lives in the prompt, not in content scrubbing — verify the literal
    // forbidden words from a lesson still appear in the rendered prompt for every mode.
    const coach = buildSystemInstruction([SAMPLE_LESSON]);
    const roleplay = buildRolePlayInstruction([SAMPLE_LESSON]);
    const feedback = buildRolePlayFeedbackInstruction([SAMPLE_LESSON]);
    for (const out of [coach, roleplay, feedback]) {
      expect(out).toContain("Spark Shift Stretch framework");
    }
  });
});
