import { describe, it, expect } from "vitest";
import {
  classifyComplexity,
  buildDepthDirective,
  type PromptComplexity,
} from "../lib/complexity";

describe("classifyComplexity", () => {
  it("treats single-word greetings as simple", () => {
    expect(classifyComplexity("hi").complexity).toBe<PromptComplexity>("simple");
    expect(classifyComplexity("Thanks!").complexity).toBe("simple");
    expect(classifyComplexity("ok").complexity).toBe("simple");
  });

  it("treats very short messages as simple", () => {
    expect(classifyComplexity("got it").complexity).toBe("simple");
    expect(classifyComplexity("yes please").complexity).toBe("simple");
  });

  it("treats short definitional questions as simple", () => {
    expect(classifyComplexity("What is active listening?").complexity).toBe("simple");
    expect(classifyComplexity("What's an I-statement?").complexity).toBe("simple");
    expect(classifyComplexity("Define feedback").complexity).toBe("simple");
  });

  it("treats long, multi-sentence scenarios as complex", () => {
    const message =
      "My manager keeps assigning me last-minute work and I'm overwhelmed. " +
      "Yesterday she added two more deliverables. " +
      "How do I push back without seeming difficult?";
    expect(classifyComplexity(message).complexity).toBe("complex");
  });

  it("treats coaching-scenario phrasing as complex", () => {
    const result = classifyComplexity(
      "How do I handle a coworker who keeps interrupting me in meetings?",
    );
    expect(result.complexity).toBe("complex");
  });

  it("treats personal scenarios with reasonable length as complex", () => {
    const result = classifyComplexity(
      "My coworker took credit for the work I did on the launch yesterday and now I feel awful",
    );
    expect(result.complexity).toBe("complex");
  });

  it("treats multi-part questions joined by conjunctions as complex", () => {
    const result = classifyComplexity(
      "How do I give feedback to my manager about workload, and also push back on a deadline that I cannot meet?",
    );
    expect(result.complexity).toBe("complex");
  });

  it("handles empty messages without throwing", () => {
    const result = classifyComplexity("");
    expect(result.complexity).toBe("simple");
    expect(result.signals).toContain("empty");
  });

  it("handles whitespace-only messages without throwing", () => {
    expect(classifyComplexity("   ").complexity).toBe("simple");
  });

  it("returns reason signals so calls can be debugged or logged", () => {
    const result = classifyComplexity("Hi");
    expect(result.signals.length).toBeGreaterThan(0);
  });
});

describe("buildDepthDirective", () => {
  it("instructs Gemini to keep simple answers short and direct", () => {
    const directive = buildDepthDirective("simple");
    expect(directive).toMatch(/SIMPLE/);
    expect(directive.toLowerCase()).toMatch(/short|direct|1.{0,3}2/);
    expect(directive.toLowerCase()).toMatch(/skip|override|do not/);
  });

  it("instructs Gemini to keep the three-beat shape for complex prompts", () => {
    const directive = buildDepthDirective("complex");
    expect(directive).toMatch(/COMPLEX/);
    expect(directive.toLowerCase()).toMatch(/three[-\s]?beat|validate.*teach.*apply/);
  });

  it("never includes the framework vocabulary", () => {
    expect(buildDepthDirective("simple")).not.toMatch(/\b(spark|shift|stretch)\b/i);
    expect(buildDepthDirective("complex")).not.toMatch(/\b(spark|shift|stretch)\b/i);
  });
});
