import { describe, it, expect } from "vitest";
import { checkEscalation } from "../lib/escalation";

describe("checkEscalation", () => {
  it("escalates harassment mentions", () => {
    const result = checkEscalation("I'm being harassed at work");
    expect(result.escalated).toBe(true);
    expect(result.message).toBeDefined();
  });

  it("escalates discrimination mentions", () => {
    const result = checkEscalation("There's discrimination in my department");
    expect(result.escalated).toBe(true);
  });

  it("escalates self-harm mentions", () => {
    const result = checkEscalation("I want to hurt myself");
    expect(result.escalated).toBe(true);
  });

  it("escalates mental health crisis", () => {
    const result = checkEscalation("I'm having a mental health crisis");
    expect(result.escalated).toBe(true);
  });

  it("escalates legal mentions", () => {
    const result = checkEscalation("I need to talk to a lawyer about this");
    expect(result.escalated).toBe(true);
  });

  it("does not escalate normal messages", () => {
    const result = checkEscalation("How do I give constructive feedback?");
    expect(result.escalated).toBe(false);
    expect(result.message).toBeUndefined();
  });

  it("does not escalate communication skill questions", () => {
    const result = checkEscalation("How should I set boundaries with my team?");
    expect(result.escalated).toBe(false);
  });

  it("includes EAP reference in escalation message", () => {
    const result = checkEscalation("I'm being harassed");
    expect(result.message).toContain("EAP");
  });
});

describe("instructional-context bypass (RESEARCH.md false-positive fix)", () => {
  describe("topic categories bypass on instructional framing", () => {
    it("'How should I document incidents of workplace harassment?' does NOT escalate", () => {
      expect(checkEscalation("How should I document incidents of workplace harassment?").escalated).toBe(false);
    });

    it("'How do I report suspected discrimination in my department?' does NOT escalate", () => {
      expect(checkEscalation("How do I report suspected discrimination in my department?").escalated).toBe(false);
    });

    it("'How should I respond if a coworker makes a threat?' does NOT escalate", () => {
      expect(checkEscalation("How should I respond if a coworker makes a threat during a heated meeting?").escalated).toBe(false);
    });

    it("'What's the legal procedure for wrongful termination?' does NOT escalate", () => {
      expect(checkEscalation("What's the legal procedure for wrongful termination?").escalated).toBe(false);
    });

    it("'Our workplace violence prevention policy says...' does NOT escalate", () => {
      expect(checkEscalation("Our workplace violence prevention policy says employees should report concerns immediately. What does that mean?").escalated).toBe(false);
    });
  });

  describe("personal-experience framing STILL escalates (no false negatives)", () => {
    it("'I am being harassed by my manager' escalates as harassment", () => {
      const result = checkEscalation("I am being harassed by my manager and need help");
      expect(result.escalated).toBe(true);
      expect(result.category).toBe("harassment");
    });

    it("'I experienced discrimination at work' escalates as discrimination", () => {
      const result = checkEscalation("I experienced discrimination at work and I need help");
      expect(result.escalated).toBe(true);
      expect(result.category).toBe("discrimination");
    });
  });

  describe("self_harm and mental_health_crisis ALWAYS fire (even instructional)", () => {
    it("'I want to kill myself' escalates as self_harm", () => {
      const result = checkEscalation("I want to kill myself");
      expect(result.escalated).toBe(true);
      expect(result.category).toBe("self_harm");
    });

    it("'How do I help someone who has suicidal thoughts?' STILL escalates as self_harm (instructional bypass NOT applied)", () => {
      const result = checkEscalation("How do I help someone who has suicidal thoughts?");
      expect(result.escalated).toBe(true);
      expect(result.category).toBe("self_harm");
    });

    it("'I am having a panic attack' escalates as mental_health_crisis", () => {
      const result = checkEscalation("I am having a panic attack right now");
      expect(result.escalated).toBe(true);
      expect(result.category).toBe("mental_health_crisis");
    });

    it("'How do I support a coworker in a mental health crisis?' STILL escalates as mental_health_crisis", () => {
      const result = checkEscalation("How do I support a coworker in a mental health crisis?");
      expect(result.escalated).toBe(true);
      expect(result.category).toBe("mental_health_crisis");
    });
  });
});
