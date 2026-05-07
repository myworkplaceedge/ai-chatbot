import assert from "node:assert/strict";
import {
  detectIntent,
  intentResultForClientIntent,
  isClientSelectableIntent,
  matchedLessonsForMessage,
  selectLessonContext,
  type LessonForIntent,
} from "./intent";

const lessons: LessonForIntent[] = [
  {
    name: "Feedback that Builds Trust",
    content:
      "Use clear feedback, balance candor with care, and prepare for a feedback conversation with examples and shared goals.",
  },
  {
    name: "Tone Without Apology",
    content:
      "Set boundaries, protect your time, and say no without sounding defensive when requests exceed your capacity.",
  },
  {
    name: "From Yes to Not Yet",
    content:
      "Negotiate a deadline, ask for more time, and reset expectations when a timeline no longer works.",
  },
  {
    name: "Close the Loop",
    content:
      "Clarify tasks, assign ownership, confirm deliverables, and align on next steps after a meeting.",
  },
];

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest("returns lesson_specific when a lesson title is referenced directly", () => {
  const result = detectIntent("In Feedback that Builds Trust, what is the core idea?", lessons);

  assert.equal(result.intent, "lesson_specific");
  assert.deepEqual(result.matchedLessons, ["Feedback that Builds Trust"]);
});

runTest("classifies feedback-oriented prompts as give_feedback", () => {
  const result = detectIntent("How should I give constructive feedback to a coworker?", lessons);

  assert.equal(result.intent, "give_feedback");
  assert.ok(result.matchedLessons.includes("Feedback that Builds Trust"));
});

runTest("classifies boundary-setting prompts as set_boundary", () => {
  const result = detectIntent("How do I set a boundary when I am overloaded with requests?", lessons);

  assert.equal(result.intent, "set_boundary");
  assert.ok(result.matchedLessons.includes("Tone Without Apology"));
});

runTest("classifies deadline negotiation prompts as push_back_deadline", () => {
  const result = detectIntent("I need more time and need to push back the deadline with my manager.", lessons);

  assert.equal(result.intent, "push_back_deadline");
  assert.ok(result.matchedLessons.includes("From Yes to Not Yet"));
});

runTest("classifies task clarity prompts as clarify_tasks", () => {
  const result = detectIntent("Can you help me clarify ownership and expectations for this deliverable?", lessons);

  assert.equal(result.intent, "clarify_tasks");
  assert.ok(result.matchedLessons.includes("Close the Loop"));
});

runTest("classifies broad communication-advice prompts as general_coaching", () => {
  const result = detectIntent("Can you coach me through a difficult workplace conversation?", lessons);

  assert.equal(result.intent, "general_coaching");
  assert.deepEqual(
    result.matchedLessons,
    lessons.map((lesson) => lesson.name),
  );
});

runTest("classifies unrelated prompts as off_topic", () => {
  const result = detectIntent("Can you tell me the weather today and a good recipe for dinner?", lessons);

  assert.equal(result.intent, "off_topic");
  assert.deepEqual(result.matchedLessons, []);
});

runTest("keeps generic in-domain prompts as general", () => {
  const result = detectIntent("What communication skills should I practice from these lessons?", lessons);

  assert.equal(result.intent, "general");
  assert.deepEqual(
    result.matchedLessons,
    lessons.map((lesson) => lesson.name),
  );
});

runTest("isClientSelectableIntent accepts only the five client intents", () => {
  assert.equal(isClientSelectableIntent("give_feedback"), true);
  assert.equal(isClientSelectableIntent("general"), false);
  assert.equal(isClientSelectableIntent("not_an_intent"), false);
});

runTest("matchedLessonsForMessage matches lesson content like detectIntent lesson matching", () => {
  const matched = matchedLessonsForMessage("Tell me about feedback and trust in the workplace.", lessons);
  assert.ok(matched.includes("Feedback that Builds Trust"));
});

runTest("intentResultForClientIntent mirrors general_coaching matchedLessons from detectIntent", () => {
  const result = intentResultForClientIntent(
    "general_coaching",
    "Coach me through a conversation.",
    lessons,
  );
  assert.equal(result.intent, "general_coaching");
  assert.deepEqual(
    result.matchedLessons,
    lessons.map((lesson) => lesson.name),
  );
});

runTest("intentResultForClientIntent uses lesson matches or falls back to all lessons", () => {
  const withMatch = intentResultForClientIntent(
    "give_feedback",
    "How does Feedback that Builds Trust apply here?",
    lessons,
  );
  assert.equal(withMatch.intent, "give_feedback");
  assert.deepEqual(withMatch.matchedLessons, ["Feedback that Builds Trust"]);

  const fallback = intentResultForClientIntent("give_feedback", "Hello", lessons);
  assert.deepEqual(
    fallback.matchedLessons,
    lessons.map((lesson) => lesson.name),
  );
});

runTest("selectLessonContext uses all, subset, or none based on intent", () => {
  assert.deepEqual(
    selectLessonContext("general_coaching", lessons, ["Feedback that Builds Trust"]).map((lesson) => lesson.name),
    lessons.map((lesson) => lesson.name),
  );

  assert.deepEqual(
    selectLessonContext("give_feedback", lessons, ["Feedback that Builds Trust"]).map((lesson) => lesson.name),
    ["Feedback that Builds Trust"],
  );

  assert.deepEqual(
    selectLessonContext("off_topic", lessons, []).map((lesson) => lesson.name),
    lessons.map((lesson) => lesson.name),
  );
});

console.log("Intent tests passed");
