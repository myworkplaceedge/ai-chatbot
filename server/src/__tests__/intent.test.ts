import { describe, it, expect } from "vitest";
import { detectIntent, intentResultForClientIntent, isClientSelectableIntent } from "../lib/intent";

const MOCK_LESSONS = [
  { name: "Giving Feedback.docx", content: "How to give constructive feedback to coworkers using the SBI model." },
  { name: "Setting Boundaries.docx", content: "Learn to set healthy boundaries at work while maintaining relationships." },
  { name: "Deadline Management.docx", content: "How to push back on unrealistic deadlines professionally." },
];

describe("detectIntent", () => {
  it("detects give_feedback intent", () => {
    const result = detectIntent("How do I give feedback to my manager?", MOCK_LESSONS);
    expect(result.intent).toBe("give_feedback");
  });

  it("detects set_boundary intent", () => {
    const result = detectIntent("I need to set boundaries with my coworker", MOCK_LESSONS);
    expect(result.intent).toBe("set_boundary");
  });

  it("falls back to general for push_back_deadline without lessons", () => {
    const result = detectIntent("How do I push back on an unrealistic deadline?", []);
    expect(["general", "push_back_deadline"]).toContain(result.intent);
  });

  it("matches lesson when title overlaps with deadline message", () => {
    const result = detectIntent("How do I push back on an unrealistic deadline?", MOCK_LESSONS);
    expect(result.matchedLessons).toContain("Deadline Management.docx");
  });

  it("detects off_topic for unrelated messages", () => {
    const result = detectIntent("What is the weather today?", MOCK_LESSONS);
    expect(result.intent).toBe("off_topic");
  });

  it("returns matched lessons", () => {
    const result = detectIntent("How do I give feedback?", MOCK_LESSONS);
    expect(result.matchedLessons.length).toBeGreaterThan(0);
  });

  it("handles empty message", () => {
    const result = detectIntent("", MOCK_LESSONS);
    expect(result.intent).toBeDefined();
  });

  it("handles empty lessons", () => {
    const result = detectIntent("How do I give feedback?", []);
    expect(result.intent).toBeDefined();
    expect(result.matchedLessons).toEqual([]);
  });
});

describe("isClientSelectableIntent", () => {
  it("accepts valid client intents", () => {
    expect(isClientSelectableIntent("give_feedback")).toBe(true);
    expect(isClientSelectableIntent("set_boundary")).toBe(true);
    expect(isClientSelectableIntent("push_back_deadline")).toBe(true);
    expect(isClientSelectableIntent("clarify_tasks")).toBe(true);
    expect(isClientSelectableIntent("general_coaching")).toBe(true);
  });

  it("rejects invalid intents", () => {
    expect(isClientSelectableIntent("off_topic")).toBe(false);
    expect(isClientSelectableIntent("random")).toBe(false);
    expect(isClientSelectableIntent("")).toBe(false);
  });
});

describe("intentResultForClientIntent", () => {
  it("returns the provided intent", () => {
    const result = intentResultForClientIntent("give_feedback", "help me with feedback", MOCK_LESSONS);
    expect(result.intent).toBe("give_feedback");
  });

  it("includes matched lessons based on message content", () => {
    const result = intentResultForClientIntent("give_feedback", "feedback to my manager", MOCK_LESSONS);
    expect(result.matchedLessons).toBeDefined();
  });
});
