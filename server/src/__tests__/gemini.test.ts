import { describe, it, expect } from "vitest";
import { VOCABULARY_RULE, buildSystemInstruction } from "../lib/gemini";

describe("VOCABULARY_RULE", () => {
  it("forbids each internal framework term by name", () => {
    expect(VOCABULARY_RULE).toMatch(/Spark/);
    expect(VOCABULARY_RULE).toMatch(/Shift/);
    expect(VOCABULARY_RULE).toMatch(/Stretch/);
  });

  it("instructs the model not to use the terms even when lesson content contains them", () => {
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/lesson/);
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/never|not/);
  });

  it("covers casing and quoting variants", () => {
    expect(VOCABULARY_RULE.toLowerCase()).toMatch(/casing|paraphrase|quoting/);
  });
});

describe("buildSystemInstruction depth calibration", () => {
  const lessonContext = [
    { name: "Giving Feedback.docx", content: "Use specific, behavioral language when giving feedback." },
  ];

  it("includes the simple-prompt depth directive when complexity is simple", () => {
    const instruction = buildSystemInstruction(lessonContext, "simple");
    expect(instruction).toMatch(/RESPONSE DEPTH/);
    expect(instruction).toMatch(/SIMPLE/);
  });

  it("includes the complex-prompt depth directive when complexity is complex", () => {
    const instruction = buildSystemInstruction(lessonContext, "complex");
    expect(instruction).toMatch(/RESPONSE DEPTH/);
    expect(instruction).toMatch(/COMPLEX/);
  });

  it("defaults to the complex (full coaching) treatment when complexity is unspecified", () => {
    const instruction = buildSystemInstruction(lessonContext);
    expect(instruction).toMatch(/COMPLEX/);
  });

  it("still embeds the vocabulary rule regardless of complexity", () => {
    expect(buildSystemInstruction(lessonContext, "simple")).toMatch(/VOCABULARY RULE/);
    expect(buildSystemInstruction(lessonContext, "complex")).toMatch(/VOCABULARY RULE/);
  });
});

describe("buildSystemInstruction progressive-disclosure (issue #35)", () => {
  const lessonContext = [
    { name: "Setting Boundaries.docx", content: "Boundaries protect time and energy." },
  ];

  it("does NOT include the clarify-first directive by default", () => {
    const instruction = buildSystemInstruction(lessonContext, "complex");
    expect(instruction).not.toMatch(/PROGRESSIVE DISCLOSURE/);
  });

  it("includes the clarify-first directive when shouldClarifyFirst is true", () => {
    const instruction = buildSystemInstruction(lessonContext, "complex", {
      shouldClarifyFirst: true,
    });
    expect(instruction).toMatch(/PROGRESSIVE DISCLOSURE/);
    expect(instruction.toLowerCase()).toMatch(/clarifying question|exactly one/);
  });

  it("omits the directive when shouldClarifyFirst is false", () => {
    const instruction = buildSystemInstruction(lessonContext, "complex", {
      shouldClarifyFirst: false,
    });
    expect(instruction).not.toMatch(/PROGRESSIVE DISCLOSURE/);
  });

  it("keeps the vocabulary rule even with the clarify directive", () => {
    const instruction = buildSystemInstruction(lessonContext, "complex", {
      shouldClarifyFirst: true,
    });
    expect(instruction).toMatch(/VOCABULARY RULE/);
  });

  // Issue #58: the clarify directive used to be appended into the same prompt
  // that contained "RESPONSE SHAPE — three beats" and "IMPORTANT: end with
  // [FOLLOW-UP]". Gemini resolved the contradiction in favor of the base
  // rules and produced a full answer + [FOLLOW-UP], defeating progressive
  // disclosure. Lock in that those conflicting blocks are NOT present when
  // shouldClarifyFirst is true.
  it("omits the three-beat RESPONSE SHAPE block when shouldClarifyFirst is true", () => {
    const instruction = buildSystemInstruction(lessonContext, "complex", {
      shouldClarifyFirst: true,
    });
    expect(instruction).not.toMatch(/RESPONSE SHAPE/);
    expect(instruction).not.toMatch(/three beats/);
  });

  it("omits the 'end with [FOLLOW-UP]' rule when shouldClarifyFirst is true", () => {
    const instruction = buildSystemInstruction(lessonContext, "complex", {
      shouldClarifyFirst: true,
    });
    // The clarify directive itself mentions "[FOLLOW-UP]" (telling the model
    // NOT to emit one). What must be absent is the contradicting base rule
    // that *requires* the model to end every response with a [FOLLOW-UP] line.
    expect(instruction).not.toMatch(/end your response with exactly one actionable follow-up/i);
  });

  it("still emits the three-beat RESPONSE SHAPE block in the default path", () => {
    const instruction = buildSystemInstruction(lessonContext, "complex");
    expect(instruction).toMatch(/RESPONSE SHAPE/);
    expect(instruction).toMatch(/end your response with exactly one actionable follow-up/i);
  });
});
