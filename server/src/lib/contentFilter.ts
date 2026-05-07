const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(porn|pornograph|xxx|nsfw|nude|naked|sexual|explicit)\b/i, reason: "explicit or sexual content" },
  { pattern: /\b(kill|murder|shoot|bomb|attack|weapon|violence|stab)\b/i, reason: "violent content" },
  { pattern: /\b(hate\s+speech|racial\s+slur|n[i1]gg|f[a@]gg)\b/i, reason: "hate speech" },
  { pattern: /\b(hack|exploit|inject|phish)\b/i, reason: "malicious intent" },
];

const PII_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, reason: "email address" },
  { pattern: /(?:^|[^\w])(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/, reason: "phone number" },
];

/**
 * Distinguish instructional framing from personal-crisis framing
 * (RESEARCH.md content-filter false-positive fix; ROADMAP success criterion #5).
 *
 * Returns true when the query is asking ABOUT a topic (workplace training
 * vocabulary like "harassment", "violence", "discrimination", "threat") rather
 * than personally experiencing it. Used by filterMessage to bypass
 * BLOCKED_PATTERNS topic checks, and by escalation.checkEscalation to bypass
 * harassment/discrimination/threats/legal_issues categories.
 *
 * Self-harm and mental_health_crisis are NEVER bypassed by callers — those
 * are always personal even when phrased instructionally ("how do I help
 * someone with suicidal thoughts" still warrants escalation pointing to EAP).
 */
export function isInstructionalQuery(input: string): boolean {
  const lower = input.toLowerCase();
  return (
    /^\s*how\s+(do|should|can|would)\s+(i|we|someone|you)\b/.test(lower) ||
    /^\s*what(\s+is|\s+are|\s+does|\s+should|'s)\b/.test(lower) ||
    /^\s*can\s+you\s+(explain|describe|help|tell|summarize)\b/.test(lower) ||
    /^\s*(our|the|a)\s+(lesson|policy|training|program|workplace)\b/.test(lower) ||
    /\b(policy|procedure|training|lesson|guide|document|report\s+it|complaint|filing)\b/.test(lower)
  );
}

export function filterMessage(input: string): { blocked: boolean; reason: string } {
  // Instructional-context bypass: BLOCKED_PATTERNS topic words like "violence",
  // "explicit" are core lesson vocabulary in workplace training. PII patterns
  // remain unconditional — emails and phones are equally PII regardless of
  // framing.
  if (!isInstructionalQuery(input)) {
    for (const { pattern, reason } of BLOCKED_PATTERNS) {
      if (pattern.test(input)) {
        return { blocked: true, reason };
      }
    }
  }
  for (const { pattern, reason } of PII_PATTERNS) {
    if (pattern.test(input)) {
      return { blocked: true, reason };
    }
  }
  return { blocked: false, reason: "" };
}
