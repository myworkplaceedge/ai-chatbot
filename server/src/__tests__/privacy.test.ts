import { describe, it, expect, vi } from "vitest";
import { stripPII, cleanExpiredSessions } from "../lib/privacy";

describe("stripPII", () => {
  it("redacts email addresses", () => {
    const result = stripPII("Contact me at john@example.com please");
    expect(result).toContain("[EMAIL REDACTED]");
    expect(result).not.toContain("john@example.com");
  });

  it("redacts phone numbers", () => {
    const result = stripPII("Call me at 555-123-4567");
    expect(result).toContain("[PHONE REDACTED]");
  });

  it("redacts SSN/SIN", () => {
    const result = stripPII("My SSN is 123-45-6789");
    expect(result).toContain("[SSN/SIN REDACTED]");
  });

  it("redacts credit card numbers", () => {
    const result = stripPII("Card: 1234 5678 9012 3456");
    expect(result).toContain("[CARD REDACTED]");
  });

  it("leaves normal text unchanged", () => {
    const input = "How do I give feedback to my manager?";
    expect(stripPII(input)).toBe(input);
  });

  it("handles multiple PII types in one message", () => {
    const result = stripPII("Email me at test@test.com or call 555-123-4567");
    expect(result).toContain("[EMAIL REDACTED]");
    expect(result).toContain("[PHONE REDACTED]");
  });

  it("redacts multiple instances of the same PII type", () => {
    const result = stripPII("Reach me at a@a.com or b@b.com");
    expect(result).not.toContain("a@a.com");
    expect(result).not.toContain("b@b.com");
    const matches = result.match(/\[EMAIL REDACTED\]/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("returns an empty string unchanged", () => {
    expect(stripPII("")).toBe("");
  });
});

describe("cleanExpiredSessions", () => {
  function buildPrismaMock(expiredIds: string[]) {
    return {
      session: {
        findMany: vi.fn(async () => expiredIds.map((id) => ({ id }))),
        deleteMany: vi.fn(async () => ({ count: expiredIds.length })),
      },
      message: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      intentLog: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    };
  }

  it("returns 0 and skips deletes when no sessions are expired", async () => {
    const prisma = buildPrismaMock([]);
    const result = await cleanExpiredSessions(prisma);

    expect(result).toBe(0);
    expect(prisma.session.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    expect(prisma.message.deleteMany).not.toHaveBeenCalled();
    expect(prisma.intentLog.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes related rows before sessions and returns the deleted count", async () => {
    const prisma = buildPrismaMock(["sess_1", "sess_2"]);
    const result = await cleanExpiredSessions(prisma);

    expect(result).toBe(2);
    expect(prisma.message.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: { in: ["sess_1", "sess_2"] } },
    });
    expect(prisma.intentLog.deleteMany).toHaveBeenCalledWith({
      where: { sessionId: { in: ["sess_1", "sess_2"] } },
    });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sess_1", "sess_2"] } },
    });
  });

  it("uses a 30-day cutoff by default", async () => {
    const prisma = buildPrismaMock([]);
    const before = Date.now();
    await cleanExpiredSessions(prisma);
    const after = Date.now();

    const call = prisma.session.findMany.mock.calls[0][0];
    const cutoff = (call.where.createdAt.lt as Date).getTime();
    const expectedMin = before - 30 * 24 * 60 * 60 * 1000 - 5;
    const expectedMax = after - 30 * 24 * 60 * 60 * 1000 + 5;
    expect(cutoff).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoff).toBeLessThanOrEqual(expectedMax);
  });

  it("honours a custom retention window", async () => {
    const prisma = buildPrismaMock([]);
    const before = Date.now();
    await cleanExpiredSessions(prisma, 7);
    const after = Date.now();

    const call = prisma.session.findMany.mock.calls[0][0];
    const cutoff = (call.where.createdAt.lt as Date).getTime();
    const expectedMin = before - 7 * 24 * 60 * 60 * 1000 - 5;
    const expectedMax = after - 7 * 24 * 60 * 60 * 1000 + 5;
    expect(cutoff).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoff).toBeLessThanOrEqual(expectedMax);
  });
});
