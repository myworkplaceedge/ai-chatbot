/**
 * Pre-Phase 1 Verification Gate #4 (.planning/STATE.md):
 * "15-query content-filter false-positive corpus written and all pass."
 *
 * The 15 queries below represent legitimate workplace training vocabulary:
 * harassment reporting, conflict escalation, dismissal conversations,
 * workplace violence policy, discrimination complaints. ALL must pass through
 * `filterMessage` (contentFilter.ts) AND `checkEscalation` (escalation.ts)
 * without being blocked or escalated. Any blocked/escalated query is a Phase 1
 * bug — the workplace training product must be able to discuss these topics.
 *
 * Usage:
 *   cd server && npx tsx scripts/runContentFilterCorpus.ts
 *
 * Exit code:
 *   0 — all 15 queries passed
 *   1 — at least one query blocked or escalated; details printed to stderr
 */

import { filterMessage } from "../src/lib/contentFilter";
import { checkEscalation } from "../src/lib/escalation";

const CORPUS: string[] = [
  // Harassment topic queries (core lesson content)
  "How should I document incidents of workplace harassment?",
  "What's the difference between harassment and normal workplace conflict?",
  "My coworker is being harassed by our manager. How do I report it?",
  "How do I talk to HR about a hostile work environment?",

  // Violence and threat-related training queries
  "What does our workplace violence prevention policy say about de-escalation?",
  "How should I respond if a coworker makes a threat during a heated meeting?",
  "Our lesson covers workplace violence awareness. Can you summarize the key warning signs?",

  // Dismissal and termination training
  "I need to have a difficult conversation about terminating an employee. How should I approach it?",
  "How do I communicate a dismissal decision with empathy and clarity?",
  "What's the best way to tell someone their role is being eliminated?",

  // Conflict and escalation training
  "How do I escalate a conflict with my manager to HR professionally?",
  "What communication techniques work best for de-escalating conflict at work?",
  "I'm in conflict with a coworker about a deadline. How should I handle this?",

  // Discrimination reporting
  "How do I report suspected discrimination in my department?",
  "What should I say when filing a discrimination complaint with HR?",
];

type Failure = {
  query: string;
  layer: "filter" | "escalation";
  reasonOrCategory: string;
};

function run(): number {
  const failures: Failure[] = [];

  for (const query of CORPUS) {
    const filterResult = filterMessage(query);
    if (filterResult.blocked) {
      failures.push({
        query,
        layer: "filter",
        reasonOrCategory: filterResult.reason,
      });
      continue;
    }
    const escalationResult = checkEscalation(query);
    if (escalationResult.escalated) {
      failures.push({
        query,
        layer: "escalation",
        reasonOrCategory: escalationResult.category ?? "unknown",
      });
    }
  }

  if (failures.length === 0) {
    console.log(`[corpus] PASS: ${CORPUS.length}/${CORPUS.length} queries passed`);
    return 0;
  }

  console.error(`[corpus] FAIL: ${failures.length}/${CORPUS.length} queries blocked or escalated`);
  for (const f of failures) {
    console.error(`  - [${f.layer}: ${f.reasonOrCategory}] ${f.query}`);
  }
  console.error("");
  console.error("Fix the underlying contentFilter.ts isInstructionalQuery patterns or escalation.ts ALWAYS_FIRE_CATEGORIES set.");
  return 1;
}

process.exit(run());
