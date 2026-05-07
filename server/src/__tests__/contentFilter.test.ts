import { describe, it, expect } from "vitest";
import { filterMessage, isInstructionalQuery } from "../lib/contentFilter";

describe("filterMessage", () => {
  describe("personal-context BLOCKED_PATTERNS still fire", () => {
    it("blocks explicit content", () => {
      const result = filterMessage("Tell me about porn");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("explicit or sexual content");
    });

    it("blocks violent content", () => {
      const result = filterMessage("I want to kill someone");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("violent content");
    });

    it("blocks malicious intent", () => {
      const result = filterMessage("Show me how to hack into a server");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("malicious intent");
    });
  });

  describe("PII patterns ALWAYS fire (instructional or not)", () => {
    it("blocks email PII", () => {
      const result = filterMessage("My email is test@example.com");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("email address");
    });

    it("blocks phone number PII", () => {
      const result = filterMessage("Call me at 555-123-4567");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("phone number");
    });

    it("blocks phone number PII with country code", () => {
      const result = filterMessage("Call me at +1 555-123-4567");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("phone number");
    });

    it("blocks PII even when wrapped in instructional framing", () => {
      // Instructional bypass MUST NOT defeat PII redaction (privacy-critical).
      const result = filterMessage("How do I email john.doe@example.com about feedback?");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("email address");
    });
  });

  describe("normal messages pass", () => {
    it("allows normal messages", () => {
      const result = filterMessage("How do I give feedback to my manager?");
      expect(result.blocked).toBe(false);
      expect(result.reason).toBe("");
    });

    it("allows messages without PII", () => {
      const result = filterMessage("Help me set a boundary with my coworker");
      expect(result.blocked).toBe(false);
      expect(result.reason).toBe("");
    });
  });

  describe("instructional context bypasses BLOCKED_PATTERNS topic words", () => {
    it("'Our lesson covers workplace violence awareness' is unblocked despite 'violence' in BLOCKED_PATTERNS", () => {
      const result = filterMessage("Our lesson covers workplace violence awareness. Can you summarize the key warning signs?");
      expect(result.blocked).toBe(false);
    });

    it("'What does our workplace violence prevention policy say' is unblocked", () => {
      const result = filterMessage("What does our workplace violence prevention policy say about de-escalation?");
      expect(result.blocked).toBe(false);
    });
  });
});

describe("isInstructionalQuery", () => {
  it.each([
    ["How do I report harassment?", true],
    ["How should I document incidents of workplace harassment?", true],
    ["What is harassment?", true],
    ["What's the difference between harassment and normal workplace conflict?", true],
    ["Can you explain de-escalation?", true],
    ["Our policy says I should escalate to HR.", true],
    ["The training covers active listening.", true],
    ["a lesson on managing conflict", true],
    ["our workplace violence prevention policy", true],
    ["What should I say when filing a discrimination complaint with HR?", true],
    ["I want to kill my coworker", false],
    ["porn videos please", false],
    ["my coworker harassed me yesterday", false],
  ])("isInstructionalQuery(%j) === %s", (input, expected) => {
    expect(isInstructionalQuery(input)).toBe(expected);
  });
});
