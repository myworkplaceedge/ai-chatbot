import { describe, it, expect } from "vitest";
import {
  classifyBreadth,
  buildClarifyDirective,
  type PromptBreadth,
} from "../lib/breadth";

describe("classifyBreadth", () => {
  it("treats canonical broad opener + topic as broad", () => {
    expect(classifyBreadth("How do I set boundaries?").breadth).toBe<PromptBreadth>("broad");
    expect(classifyBreadth("How do I give feedback?").breadth).toBe("broad");
    expect(classifyBreadth("How do I handle conflict?").breadth).toBe("broad");
    expect(classifyBreadth("Tell me about feedback").breadth).toBe("broad");
    expect(classifyBreadth("Tips on difficult conversations").breadth).toBe("broad");
  });

  it("treats topic-only short prompts as broad when paired with a broad opener", () => {
    expect(classifyBreadth("How do I deal with pushback?").breadth).toBe("broad");
    expect(classifyBreadth("Help me with deadlines").breadth).toBe("broad");
  });

  it("treats prompts with concrete scenario markers as specific", () => {
    expect(
      classifyBreadth(
        "How do I set a boundary with my manager who keeps assigning me weekend work?",
      ).breadth,
    ).toBe("specific");
    expect(
      classifyBreadth("My coworker said I was being pushy in standup yesterday").breadth,
    ).toBe("specific");
    expect(
      classifyBreadth("My manager told me my last review was too soft").breadth,
    ).toBe("specific");
  });

  it("treats long detailed prompts as specific even without a named relationship", () => {
    const message =
      "I'm preparing for a one-on-one tomorrow and I need to give the engineer some hard feedback about how they handled the incident review last week without making them defensive.";
    expect(classifyBreadth(message).breadth).toBe("specific");
  });

  it("treats short definitional questions as specific (not broad)", () => {
    // These are simple but already targeted — they don't need clarifying.
    expect(classifyBreadth("What is active listening?").breadth).toBe("specific");
    expect(classifyBreadth("What's an I-statement?").breadth).toBe("specific");
  });

  it("treats greetings and acknowledgements as specific (no clarifying needed)", () => {
    expect(classifyBreadth("hi").breadth).toBe("specific");
    expect(classifyBreadth("thanks!").breadth).toBe("specific");
    expect(classifyBreadth("got it").breadth).toBe("specific");
  });

  it("handles empty / whitespace messages without throwing", () => {
    expect(classifyBreadth("").breadth).toBe("specific");
    expect(classifyBreadth("   ").breadth).toBe("specific");
  });

  it("returns reason signals for debugging", () => {
    const result = classifyBreadth("How do I set boundaries?");
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.signals.some((s) => s.startsWith("broad_opener:"))).toBe(true);
    expect(result.signals.some((s) => s.startsWith("broad_topic:"))).toBe(true);
  });

  it("ignores a polite preamble before a broad opener", () => {
    expect(classifyBreadth("Hey how do I set boundaries?").breadth).toBe("broad");
    expect(classifyBreadth("So how do I give feedback?").breadth).toBe("broad");
  });
});

describe("buildClarifyDirective", () => {
  it("instructs the model to ask exactly one focused clarifying question", () => {
    const directive = buildClarifyDirective();
    expect(directive).toMatch(/PROGRESSIVE DISCLOSURE/);
    expect(directive.toLowerCase()).toMatch(/one (focused )?clarifying question|exactly one/);
  });

  it("warns the model not to dump the full lesson", () => {
    const directive = buildClarifyDirective();
    expect(directive.toLowerCase()).toMatch(/do not (deliver|provide).*(full|three[-\s]?beat|lesson)/);
  });

  it("caps at 2-3 angles to keep the question quick to answer", () => {
    const directive = buildClarifyDirective();
    expect(directive).toMatch(/2.{0,3}3 (plausible )?angles|two.{0,5}three angles/i);
  });

  it("forbids stacking multiple clarifying questions", () => {
    const directive = buildClarifyDirective();
    expect(directive.toLowerCase()).toMatch(/not (stack|ask).*multiple|do not stack|never list more than three/);
  });

  it("never includes the framework vocabulary", () => {
    expect(buildClarifyDirective()).not.toMatch(/\b(spark|shift|stretch)\b/i);
  });
});
