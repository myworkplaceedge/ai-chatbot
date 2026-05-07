/**
 * Privacy controls for PII detection, stripping, and data retention.
 *
 * Retention policy: Sessions older than 30 days are eligible for deletion.
 * PII is redacted from user messages before database storage.
 */

const PII_REPLACEMENTS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL REDACTED]" },
  { pattern: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE REDACTED]" },
  { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, replacement: "[SSN/SIN REDACTED]" },
  { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: "[CARD REDACTED]" },
];

/** Redact detected PII from text before storage. */
export function stripPII(text: string): string {
  let result = text;
  for (const { pattern, replacement } of PII_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Delete sessions (and their messages/intents) older than the given number of days. */
export async function cleanExpiredSessions(
  prisma: {
    session: {
      findMany: (args: { where: { createdAt: { lt: Date } }; select: { id: true } }) => Promise<{ id: string }[]>;
      deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<{ count: number }>;
    };
    message: { deleteMany: (args: { where: { sessionId: { in: string[] } } }) => Promise<{ count: number }> };
    intentLog: { deleteMany: (args: { where: { sessionId: { in: string[] } } }) => Promise<{ count: number }> };
  },
  retentionDays = 30,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const expired = await prisma.session.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true },
  });

  if (expired.length === 0) return 0;

  const ids = expired.map((s) => s.id);

  // Delete related records first, then sessions
  await prisma.message.deleteMany({ where: { sessionId: { in: ids } } });
  await prisma.intentLog.deleteMany({ where: { sessionId: { in: ids } } });
  const result = await prisma.session.deleteMany({ where: { id: { in: ids } } });

  return result.count;
}
