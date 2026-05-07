import { isInstructionalQuery } from "./contentFilter";

export type EscalationCategory =
  | "harassment"
  | "discrimination"
  | "mental_health_crisis"
  | "self_harm"
  | "threats"
  | "legal_issues";

const ESCALATION_CATEGORIES: Record<EscalationCategory, string[]> = {
  harassment: [
    "harassment",
    "being harassed",
    "sexual harassment",
    "hostile work environment",
    "hostile workplace",
    "retaliation",
    "whistleblow",
    "abuse",
    "being abused",
    "assault",
  ],
  discrimination: [
    "discriminat",
    "racism",
    "sexism",
    "ageism",
    "bias against",
    "treated unfairly because",
  ],
  mental_health_crisis: [
    "mental health crisis",
    "breaking down",
    "can't cope",
    "cannot cope",
    "overwhelmed and don't know",
    "panic attack",
  ],
  self_harm: [
    "self-harm",
    "self harm",
    "suicid",
    "want to die",
    "kill myself",
    "hurt myself",
    "harming myself",
    "end my life",
  ],
  threats: [
    "threat",
    "threaten",
    "being threatened",
    "violence",
    "unsafe work",
    "safety violation",
    "unsafe conditions",
  ],
  legal_issues: [
    "legal action",
    "lawyer",
    "attorney",
    "filing a complaint",
    "eeoc",
    "human rights complaint",
    "wrongful termination",
    "sue my employer",
    "litigation",
  ],
};

/**
 * Categories that ALWAYS fire regardless of instructional framing
 * (RESEARCH.md content-filter false-positive fix). These are personal-crisis
 * categories where even an instructional question warrants escalation:
 * "How do I help someone with suicidal thoughts?" still routes to EAP.
 */
const ALWAYS_FIRE_CATEGORIES: ReadonlySet<EscalationCategory> = new Set([
  "self_harm",
  "mental_health_crisis",
]);

export type EscalationResult = {
  escalated: boolean;
  category?: EscalationCategory;
  message?: string;
};

const ESCALATION_MESSAGE =
  "This sounds important — please reach out to your HR department, manager, or Employee Assistance Program (EAP). I'm a learning coach and can help with communication skills, but this concern deserves professional support.";

export function checkEscalation(userMessage: string): EscalationResult {
  const lower = userMessage.toLowerCase();
  const isInstructional = isInstructionalQuery(userMessage);

  for (const [category, phrases] of Object.entries(ESCALATION_CATEGORIES) as [EscalationCategory, string[]][]) {
    // Bypass topic-context categories when the query is instructional
    // (e.g., "how do I report harassment?" is training, not personal crisis).
    // Self-harm and mental_health_crisis ALWAYS fire — those are personal
    // even when phrased instructionally.
    if (isInstructional && !ALWAYS_FIRE_CATEGORIES.has(category)) {
      continue;
    }
    if (phrases.some((phrase) => lower.includes(phrase))) {
      return { escalated: true, category, message: ESCALATION_MESSAGE };
    }
  }

  return { escalated: false };
}
