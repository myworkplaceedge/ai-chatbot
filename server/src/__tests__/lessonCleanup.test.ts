import { describe, it, expect } from "vitest";
import {
  cleanLessonContentWithAudit,
  stripDesignerSections,
} from "../lib/lessonCleanup";

describe("stripDesignerSections", () => {
  it("returns empty string for empty/invalid input", () => {
    expect(stripDesignerSections("")).toBe("");
    // @ts-expect-error verifying runtime safety
    expect(stripDesignerSections(null)).toBe("");
    // @ts-expect-error verifying runtime safety
    expect(stripDesignerSections(undefined)).toBe("");
  });

  it("is a no-op when no designer sections are present", () => {
    const input = [
      "Lesson Overview",
      "",
      "This lesson covers boundary language.",
      "",
      "Facilitator Tip: Encourage open discussion.",
      "",
      "Learner Instructions: Reflect on a recent boundary conversation.",
    ].join("\n");
    // No-op should return the exact same string (no whitespace churn)
    expect(stripDesignerSections(input)).toBe(input);
  });

  it("strips a 'DESIGNER PROMPT' block until the next labeled section", () => {
    const input = [
      "Why this matters: Communication shapes outcomes.",
      "",
      "DESIGNER PROMPT: Suggested Interaction or Visual",
      "Use illustrations or iconography to show a calm posture.",
      "Title: Clarify With Confidence",
      "",
      "Cultural Note: In some cultures, direct clarification can feel uncomfortable.",
    ].join("\n");
    const out = stripDesignerSections(input);
    expect(out).not.toMatch(/DESIGNER PROMPT/i);
    expect(out).not.toContain("Use illustrations or iconography");
    expect(out).not.toContain("Title: Clarify With Confidence");
    // Surrounding learner-facing content preserved
    expect(out).toContain("Why this matters: Communication shapes outcomes.");
    expect(out).toContain("Cultural Note: In some cultures");
  });

  it("strips an 'Add-on for Designers' block but preserves the next prompt", () => {
    const input = [
      "Reflection Prompt: Think about a time you stayed silent.",
      "",
      "Add-on for Designers: Consider pairing this with a textbox or visual.",
      "Use a callout treatment so it stands out.",
      "",
      "Reflection Prompt: What invisible strain did silence place on your team?",
    ].join("\n");
    const out = stripDesignerSections(input);
    expect(out).not.toMatch(/Add-on for Designers/i);
    expect(out).not.toContain("Use a callout treatment");
    expect(out).toContain("Reflection Prompt: Think about a time");
    expect(out).toContain("Reflection Prompt: What invisible strain");
  });

  it("strips 'Instructions for the designer' sections", () => {
    const input = [
      "Activity: Practice giving feedback.",
      "",
      "Instructions for the designer: Place this slide after the intro.",
      "Make sure the visual matches the brand guide.",
      "",
      "Learner Instructions: Try the SBI model.",
    ].join("\n");
    const out = stripDesignerSections(input);
    expect(out).not.toMatch(/Instructions for the designer/i);
    expect(out).not.toContain("Place this slide");
    expect(out).not.toContain("brand guide");
    expect(out).toContain("Activity: Practice giving feedback.");
    expect(out).toContain("Learner Instructions: Try the SBI model.");
  });

  it("strips 'Note for designers' / 'For the designer' / 'Internal note' headings", () => {
    const variants = [
      "Note for designers: animate the icon on hover.",
      "Notes for designer: use the brand palette.",
      "For the designer: add a transition here.",
      "Internal note: this section is provisional.",
      "Internal use only: track engagement here.",
      "Authoring note: rewrite once SME signs off.",
      "Designer Notes: spacing should be 24px.",
      "Designer's Prompt: visualize this metaphor.",
      "[DESIGNER]: include a sidebar callout.",
      "(Designer): swap stock photo.",
    ];
    for (const heading of variants) {
      const input = [
        "Learner Instructions: Practice the phrase aloud.",
        "",
        heading,
        "Some internal authoring detail line.",
        "",
        "Cultural Note: Tone matters.",
      ].join("\n");
      const out = stripDesignerSections(input);
      expect(out, `failed on heading: ${heading}`).not.toContain("Some internal authoring detail line.");
      expect(out).toContain("Learner Instructions: Practice the phrase aloud.");
      expect(out).toContain("Cultural Note: Tone matters.");
    }
  });

  it("treats a horizontal rule line as a designer-block terminator", () => {
    const input = [
      "Why this matters: Stuff.",
      "",
      "DESIGNER PROMPT: Suggested Interaction",
      "Internal layout direction line.",
      "—",
      "Reflection Prompt: What did you notice?",
    ].join("\n");
    const out = stripDesignerSections(input);
    expect(out).not.toContain("Internal layout direction line.");
    expect(out).not.toMatch(/DESIGNER PROMPT/i);
    expect(out).toContain("Reflection Prompt: What did you notice?");
  });

  it("strips inline parenthetical designer asides", () => {
    const input =
      "Practice the phrase aloud (designer note: pair with audio cue) and then reflect.";
    const out = stripDesignerSections(input);
    expect(out).not.toContain("designer note");
    expect(out).toContain("Practice the phrase aloud");
    expect(out).toContain("and then reflect.");
  });

  it("strips inline bracketed designer asides", () => {
    const input = "Try the phrase [designer: add hover state] in your next 1:1.";
    const out = stripDesignerSections(input);
    expect(out).not.toContain("designer:");
    expect(out).toContain("Try the phrase");
    expect(out).toContain("in your next 1:1.");
  });

  it("does not strip lesson content that merely mentions a designer in prose", () => {
    const input =
      "During a fast moving product meeting, a designer nodded at a change request but didn't clarify.";
    expect(stripDesignerSections(input)).toBe(input);
  });

  it("is idempotent — running twice equals running once", () => {
    const input = [
      "Lesson Overview",
      "",
      "Facilitator Tip: Listen actively.",
      "",
      "DESIGNER PROMPT: Visual treatment",
      "Use a sidebar callout for this.",
      "",
      "Learner Instructions: Reflect for 2 minutes.",
      "",
      "Add-on for Designers: animate the diagram.",
      "Use the brand palette.",
      "",
      "Cultural Note: Tone matters.",
    ].join("\n");
    const once = stripDesignerSections(input);
    const twice = stripDesignerSections(once);
    expect(twice).toBe(once);
  });

  it("handles a designer block that runs to end of document", () => {
    const input = [
      "Learner Instructions: Practice aloud.",
      "",
      "DESIGNER PROMPT: Suggested visual",
      "Some authoring detail.",
      "More authoring detail.",
    ].join("\n");
    const out = stripDesignerSections(input);
    expect(out).toContain("Learner Instructions: Practice aloud.");
    expect(out).not.toMatch(/DESIGNER PROMPT/i);
    expect(out).not.toContain("authoring detail");
  });

  it("preserves Facilitator Notes content adjacent to a designer block", () => {
    const input = [
      "Facilitator Notes: Help learners explore tone.",
      "",
      "DESIGNER PROMPT: Visual",
      "Internal direction.",
      "",
      "Facilitator Tip: If learners hesitate, model the phrase.",
    ].join("\n");
    const out = stripDesignerSections(input);
    expect(out).toContain("Facilitator Notes: Help learners explore tone.");
    expect(out).toContain("Facilitator Tip: If learners hesitate, model the phrase.");
    expect(out).not.toContain("Internal direction.");
  });
});

describe("cleanLessonContentWithAudit", () => {
  it("returns a no-change audit when input has no designer content", () => {
    const input = [
      "Lesson Overview",
      "",
      "Facilitator Tip: Listen actively.",
    ].join("\n");
    const { cleaned, audit } = cleanLessonContentWithAudit(input);
    expect(cleaned).toBe(input);
    expect(audit).toEqual({
      changed: false,
      bytesRemoved: 0,
      linesRemoved: 0,
      designerHeadingsMatched: [],
      inlineAsidesRemoved: 0,
    });
  });

  it("handles empty / non-string input safely", () => {
    expect(cleanLessonContentWithAudit("").audit.changed).toBe(false);
    // @ts-expect-error verifying runtime safety
    expect(cleanLessonContentWithAudit(null).cleaned).toBe("");
    // @ts-expect-error verifying runtime safety
    expect(cleanLessonContentWithAudit(undefined).audit.changed).toBe(false);
  });

  it("reports byte/line deltas and matched headings when stripping a block", () => {
    const input = [
      "Why this matters: Communication shapes outcomes.",
      "",
      "DESIGNER PROMPT: Suggested visual",
      "Internal layout direction.",
      "More authoring detail.",
      "",
      "Cultural Note: Tone matters.",
    ].join("\n");
    const { cleaned, audit } = cleanLessonContentWithAudit(input);
    expect(audit.changed).toBe(true);
    expect(audit.bytesRemoved).toBeGreaterThan(0);
    expect(audit.linesRemoved).toBeGreaterThan(0);
    expect(audit.designerHeadingsMatched).toContain(
      "DESIGNER PROMPT: Suggested visual",
    );
    expect(cleaned).not.toMatch(/DESIGNER PROMPT/i);
    expect(cleaned).toContain("Cultural Note: Tone matters.");
  });

  it("counts inline designer asides without double-counting block headings", () => {
    const input = [
      "Practice the phrase aloud (designer note: pair with audio cue) and reflect.",
      "Try the phrase [designer: add hover state] in your next 1:1.",
    ].join("\n");
    const { audit } = cleanLessonContentWithAudit(input);
    expect(audit.changed).toBe(true);
    expect(audit.inlineAsidesRemoved).toBe(2);
    expect(audit.designerHeadingsMatched).toEqual([]);
  });

  it("is idempotent: re-running on cleaned content produces a no-change audit", () => {
    const input = [
      "Lesson Overview",
      "",
      "DESIGNER PROMPT: Visual treatment",
      "Use a sidebar callout for this.",
      "",
      "Learner Instructions: Reflect for 2 minutes.",
    ].join("\n");
    const first = cleanLessonContentWithAudit(input);
    expect(first.audit.changed).toBe(true);
    const second = cleanLessonContentWithAudit(first.cleaned);
    expect(second.cleaned).toBe(first.cleaned);
    expect(second.audit.changed).toBe(false);
    expect(second.audit.bytesRemoved).toBe(0);
    expect(second.audit.linesRemoved).toBe(0);
    expect(second.audit.designerHeadingsMatched).toEqual([]);
    expect(second.audit.inlineAsidesRemoved).toBe(0);
  });

  it("dedupes repeated designer headings in the audit list", () => {
    const input = [
      "Intro paragraph.",
      "",
      "Designer Note: spacing.",
      "Some authoring detail.",
      "",
      "Learner Instructions: Try it.",
      "",
      "Designer Note: spacing.",
      "More authoring detail.",
      "",
      "Cultural Note: Tone matters.",
    ].join("\n");
    const { audit } = cleanLessonContentWithAudit(input);
    expect(audit.changed).toBe(true);
    // Same heading appears twice in input but should only appear once in audit.
    const occurrences = audit.designerHeadingsMatched.filter(
      (h) => h === "Designer Note: spacing.",
    ).length;
    expect(occurrences).toBe(1);
  });
});
