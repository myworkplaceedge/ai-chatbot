export type Intent =
  | "general"
  | "lesson_specific"
  | "give_feedback"
  | "set_boundary"
  | "push_back_deadline"
  | "clarify_tasks"
  | "general_coaching"
  | "off_topic";

export type LessonForIntent = {
  name: string;
  content: string;
};

export type IntentResult = {
  intent: Intent;
  matchedLessons: string[];
};

type IntentRule = {
  intent: Exclude<Intent, "general" | "lesson_specific" | "off_topic">;
  phrases: string[];
  keywords: string[];
};

const DOMAIN_KEYWORDS = [
  "communication",
  "communicate",
  "conversation",
  "feedback",
  "boundary",
  "deadline",
  "clarify",
  "clarification",
  "expectation",
  "ownership",
  "workplace",
  "manager",
  "coworker",
  "coworkers",
  "colleague",
  "colleagues",
  "team",
  "meeting",
  "conflict",
  "tone",
  "listen",
  "listening",
  "interrupt",
  "interruptions",
  "alignment",
  "followup",
  "follow-up",
  "miscommunication",
  "conversation",
  "respond",
  "response",
];

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "should",
  "that",
  "the",
  "their",
  "them",
  "these",
  "this",
  "to",
  "we",
  "what",
  "when",
  "with",
  "you",
  "your",
]);

const GENERAL_IN_DOMAIN_PHRASES = [
  "this lesson",
  "these lessons",
  "communication skills",
  "communication skill",
  "difficult conversation",
  "work conversation",
  "workplace conversation",
];

const OFF_TOPIC_PHRASES = [
  "weather today",
  "tell me a joke",
  "write code",
  "debug this code",
  "stock price",
  "sports score",
  "movie recommendation",
  "translate this",
  "solve this math",
  "recipe for",
];

const OFF_TOPIC_KEYWORDS = [
  "weather",
  "forecast",
  "temperature",
  "joke",
  "recipe",
  "cook",
  "cooking",
  "movie",
  "movies",
  "tv",
  "sport",
  "sports",
  "score",
  "stocks",
  "bitcoin",
  "crypto",
  "javascript",
  "python",
  "typescript",
  "code",
  "coding",
  "debug",
  "bug",
  "translate",
  "translation",
  "equation",
  "math",
];

const INTENT_RULES: IntentRule[] = [
  {
    intent: "give_feedback",
    phrases: [
      "give feedback",
      "deliver feedback",
      "share feedback",
      "hard feedback",
      "constructive feedback",
      "performance feedback",
      "feedback conversation",
      "difficult feedback",
    ],
    keywords: [
      "feedback",
      "coach",
      "coaching",
      "critique",
      "praise",
      "recognition",
      "corrective",
      "review",
      "reviewing",
    ],
  },
  {
    intent: "set_boundary",
    phrases: [
      "set a boundary",
      "set boundaries",
      "hold a boundary",
      "say no",
      "protect my time",
      "protect my energy",
      "too much work",
      "too many asks",
    ],
    keywords: [
      "boundary",
      "boundaries",
      "limit",
      "limits",
      "capacity",
      "overloaded",
      "overcommitted",
      "pushback",
      "no",
      "decline",
    ],
  },
  {
    intent: "push_back_deadline",
    phrases: [
      "push back the deadline",
      "move the deadline",
      "extend the deadline",
      "need more time",
      "cannot finish on time",
      "won't make the deadline",
      "renegotiate the deadline",
      "not ready yet",
    ],
    keywords: [
      "deadline",
      "timeline",
      "extension",
      "extend",
      "delay",
      "delayed",
      "postpone",
      "schedule",
      "reschedule",
      "timing",
    ],
  },
  {
    intent: "clarify_tasks",
    phrases: [
      "clarify the task",
      "clarify tasks",
      "clear up expectations",
      "who owns what",
      "what does success look like",
      "make this clearer",
      "align on expectations",
      "define next steps",
    ],
    keywords: [
      "clarify",
      "clarification",
      "expectations",
      "expectation",
      "task",
      "tasks",
      "ownership",
      "owner",
      "scope",
      "priority",
      "priorities",
      "deliverable",
      "deliverables",
      "aligned",
      "alignment",
    ],
  },
  {
    intent: "general_coaching",
    phrases: [
      "how should i handle",
      "how do i handle",
      "how should i approach",
      "how do i approach",
      "what should i say",
      "help me communicate",
      "coach me through",
      "advice for a conversation",
    ],
    keywords: [
      "advice",
      "approach",
      "coach",
      "coaching",
      "handle",
      "navigating",
      "conversation",
      "communicate",
      "communicating",
      "respond",
      "response",
    ],
  },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

function countPhraseMatches(text: string, phrases: string[]): number {
  return phrases.reduce((count, phrase) => count + (text.includes(phrase) ? 1 : 0), 0);
}

function countKeywordMatches(tokens: Set<string>, keywords: string[]): number {
  return keywords.reduce((count, keyword) => count + (tokens.has(keyword) ? 1 : 0), 0);
}

function hasStrongLessonReference(messageText: string): boolean {
  return (
    messageText.includes("lesson") ||
    messageText.includes("module") ||
    messageText.includes("scenario") ||
    messageText.includes("worksheet")
  );
}

function isDomainMessage(messageText: string, messageTokens: Set<string>): boolean {
  return (
    countPhraseMatches(messageText, GENERAL_IN_DOMAIN_PHRASES) > 0 ||
    countKeywordMatches(messageTokens, DOMAIN_KEYWORDS) > 0 ||
    hasStrongLessonReference(messageText)
  );
}

function scoreLessonMatch(messageText: string, messageTokens: Set<string>, lesson: LessonForIntent): number {
  const lessonText = `${lesson.name} ${lesson.content}`.toLowerCase();
  const lessonTokens = new Set(tokenize(lessonText));
  let score = 0;

  for (const token of messageTokens) {
    if (lessonTokens.has(token)) {
      score += lesson.name.toLowerCase().includes(token) ? 3 : 1;
    }
  }

  if (messageText.includes(lesson.name.toLowerCase())) {
    score += 6;
  }

  return score;
}

function getLessonMatches(messageText: string, messageTokens: Set<string>, lessons: LessonForIntent[]): string[] {
  const scoredLessons = lessons
    .map((lesson) => ({
      name: lesson.name,
      score: scoreLessonMatch(messageText, messageTokens, lesson),
    }))
    .filter((lesson) => lesson.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scoredLessons.length === 0) {
    return [];
  }

  const bestScore = scoredLessons[0].score;
  const minimumScore = bestScore >= 6 ? 2 : 1;

  return scoredLessons
    .filter((lesson) => lesson.score >= minimumScore)
    .map((lesson) => lesson.name);
}

function scoreIntentRule(messageText: string, messageTokens: Set<string>, rule: IntentRule): number {
  const phraseScore = countPhraseMatches(messageText, rule.phrases) * 3;
  const keywordScore = countKeywordMatches(messageTokens, rule.keywords);
  return phraseScore + keywordScore;
}

function detectSpecificIntent(messageText: string, messageTokens: Set<string>): Intent | null {
  let bestIntent: Intent | null = null;
  let bestScore = 0;

  for (const rule of INTENT_RULES) {
    const score = scoreIntentRule(messageText, messageTokens, rule);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = rule.intent;
    }
  }

  return bestScore >= 2 ? bestIntent : null;
}

function isLikelyOffTopic(messageText: string, messageTokens: Set<string>): boolean {
  const offTopicScore =
    countPhraseMatches(messageText, OFF_TOPIC_PHRASES) * 3 +
    countKeywordMatches(messageTokens, OFF_TOPIC_KEYWORDS);

  if (offTopicScore === 0) {
    return false;
  }

  return !isDomainMessage(messageText, messageTokens);
}

export function detectIntent(message: string, lessons: LessonForIntent[]): IntentResult {
  const normalizedMessage = message.toLowerCase().trim();
  const messageTokens = new Set(tokenize(normalizedMessage));
  const matchedLessons = getLessonMatches(normalizedMessage, messageTokens, lessons);

  const specificIntent = detectSpecificIntent(normalizedMessage, messageTokens);
  if (specificIntent) {
    if (specificIntent === "general_coaching") {
      return { intent: specificIntent, matchedLessons: lessons.map((lesson) => lesson.name) };
    }

    return {
      intent: specificIntent,
      matchedLessons: matchedLessons.length > 0 ? matchedLessons : lessons.map((lesson) => lesson.name),
    };
  }

  if (matchedLessons.length > 0) {
    return { intent: "lesson_specific", matchedLessons };
  }

  if (isLikelyOffTopic(normalizedMessage, messageTokens)) {
    return { intent: "off_topic", matchedLessons: [] };
  }

  if (isDomainMessage(normalizedMessage, messageTokens)) {
    return { intent: "general", matchedLessons: lessons.map((lesson) => lesson.name) };
  }

  return { intent: "general", matchedLessons: lessons.map((lesson) => lesson.name) };
}

export const CLIENT_SELECTABLE_INTENTS = [
  "give_feedback",
  "set_boundary",
  "push_back_deadline",
  "clarify_tasks",
  "general_coaching",
] as const;

export type ClientSelectableIntent = (typeof CLIENT_SELECTABLE_INTENTS)[number];

export function isClientSelectableIntent(value: string): value is ClientSelectableIntent {
  return (CLIENT_SELECTABLE_INTENTS as readonly string[]).includes(value);
}

export function matchedLessonsForMessage(message: string, lessons: LessonForIntent[]): string[] {
  const normalizedMessage = message.toLowerCase().trim();
  const messageTokens = new Set(tokenize(normalizedMessage));
  return getLessonMatches(normalizedMessage, messageTokens, lessons);
}

export function intentResultForClientIntent(
  intent: ClientSelectableIntent,
  message: string,
  lessons: LessonForIntent[],
): IntentResult {
  if (intent === "general_coaching") {
    return { intent, matchedLessons: lessons.map((lesson) => lesson.name) };
  }

  const matchedLessons = matchedLessonsForMessage(message, lessons);
  return {
    intent,
    matchedLessons: matchedLessons.length > 0 ? matchedLessons : lessons.map((lesson) => lesson.name),
  };
}

export function selectLessonContext(intent: Intent, lessons: LessonForIntent[], matchedLessons: string[]) {
  if (intent === "off_topic") {
    // Keep lesson text available so the model is not told "upload lessons" when DB has content;
    // system prompt still instructs a polite off-topic redirect.
    return lessons;
  }

  if (intent === "general" || intent === "general_coaching") {
    return lessons;
  }

  return lessons.filter((lesson) => matchedLessons.includes(lesson.name));
}
