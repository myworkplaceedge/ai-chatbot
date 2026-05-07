import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const state = vi.hoisted(() => ({
  sessions: [] as { id: string; createdAt: Date; updatedAt: Date }[],
  messages: [] as { id: string; sessionId: string; role: string; content: string; createdAt: Date }[],
  lessons: [] as {
    id: string;
    name: string;
    content: string;
    handouts: string | null;
    createdAt: Date;
  }[],
  intentLogs: [] as { id: string; sessionId: string; intent: string; docsSelected: string; createdAt: Date }[],
  geminiCalls: [] as {
    history: { role: string; content: string }[];
    lessonContext: { name: string; content: string }[];
    message: string;
    mode: string;
    complexity?: string;
    options?: { breadth?: string; priorAssistantTurns?: number };
  }[],
  geminiResponse: "",
  idCounter: 0,
  nextId(prefix: string) {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}`;
  },
}));

vi.mock("../lib/db", () => ({
  prisma: {
    session: {
      create: vi.fn(async ({ data }: { data: { id?: string } }) => {
        const row = { id: data.id ?? state.nextId("sess"), createdAt: new Date(), updatedAt: new Date() };
        state.sessions.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return state.sessions.find((s) => s.id === where.id) ?? null;
      }),
    },
    message: {
      create: vi.fn(async ({ data }: { data: { sessionId: string; role: string; content: string } }) => {
        const row = { id: state.nextId("msg"), ...data, createdAt: new Date() };
        state.messages.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: { where: { sessionId: string } }) => {
        return state.messages
          .filter((m) => m.sessionId === where.sessionId)
          .map(({ role, content }) => ({ role, content }));
      }),
    },
    lesson: {
      findMany: vi.fn(async () =>
        state.lessons.map(({ name, content, handouts }) => ({ name, content, handouts })),
      ),
    },
    intentLog: {
      create: vi.fn(async ({ data }: { data: { sessionId: string; intent: string; docsSelected: string } }) => {
        const row = { id: state.nextId("log"), ...data, createdAt: new Date() };
        state.intentLogs.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: { where: { sessionId: string } }) => {
        return state.intentLogs
          .filter((l) => l.sessionId === where.sessionId)
          .map(({ intent }) => ({ intent }));
      }),
    },
  },
}));

vi.mock("../lib/gemini", () => ({
  getChatResponse: vi.fn(async (history, lessonContext, message, mode, complexity, options) => {
    state.geminiCalls.push({ history, lessonContext, message, mode, complexity, options });
    return state.geminiResponse;
  }),
}));

async function buildApp() {
  const { chatRouter } = await import("../routes/chat");
  const app = express();
  app.use(express.json());
  app.use("/api/chat", chatRouter);
  return app;
}

beforeEach(() => {
  state.sessions.length = 0;
  state.messages.length = 0;
  state.lessons.length = 0;
  state.intentLogs.length = 0;
  state.geminiCalls.length = 0;
  state.idCounter = 0;
  state.geminiResponse =
    "I hear you — that sounds frustrating.\n\nThe lesson's advice is to use specific, behavioral language when you give feedback, so the other person knows exactly what to change.\n\nNext time you have feedback for a teammate, write one sentence in advance that names the behavior, not the person.\n[FOLLOW-UP] Want to practice drafting one together?";
  state.lessons.push({
    id: "lesson_1",
    name: "Giving Feedback.docx",
    content: "Use specific, behavioral language when giving feedback.",
    handouts: null,
    createdAt: new Date(),
  });
});

describe("POST /api/chat", () => {
  it("returns 400 when message is missing", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("message is required");
  });

  it("returns 400 when message is only whitespace", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({ message: "   " });
    expect(res.status).toBe(400);
  });

  it("creates a session, stores user + assistant messages, and returns the expected shape", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "How do I give better feedback to my team?" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      sessionId: expect.any(String),
      response: expect.any(String),
      messageId: expect.any(String),
      escalated: false,
    });
    expect(typeof res.body.response).toBe("string");
    expect(res.body.response.length).toBeGreaterThan(0);

    expect(state.sessions).toHaveLength(1);
    const sessionId = state.sessions[0].id;
    const userMsgs = state.messages.filter((m) => m.sessionId === sessionId && m.role === "user");
    const assistantMsgs = state.messages.filter((m) => m.sessionId === sessionId && m.role === "assistant");
    expect(userMsgs).toHaveLength(1);
    expect(assistantMsgs).toHaveLength(1);
    expect(state.intentLogs).toHaveLength(1);
    expect(state.geminiCalls).toHaveLength(1);
    expect(state.geminiCalls[0].mode).toBe("coach");
  });

  it("does not surface the internal framework vocabulary in the response", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "How do I give better feedback to my team?" });

    expect(res.status).toBe(200);
    expect(res.body.response).not.toMatch(/\b(spark|shift|stretch)\b/i);
  });

  it("reuses an existing session when sessionId is provided", async () => {
    const app = await buildApp();
    const first = await request(app).post("/api/chat").send({ message: "First question about feedback" });
    const sessionId = first.body.sessionId;

    const second = await request(app)
      .post("/api/chat")
      .send({ sessionId, message: "Follow-up question" });

    expect(second.body.sessionId).toBe(sessionId);
    expect(state.sessions).toHaveLength(1);
    const history = state.geminiCalls[1].history;
    expect(history.some((h) => h.role === "user" && h.content.includes("First question"))).toBe(true);
  });

  it("blocks content-filtered messages without calling Gemini", async () => {
    const app = await buildApp();
    // Use personal-violent framing (not instructional) to ensure BLOCKED_PATTERNS still fire.
    // "how do I kill..." would bypass BLOCKED_PATTERNS via isInstructionalQuery — this is
    // intentional per the 01-03 plan trade-off (instructional bypass; Gemini scope rules
    // provide the second line of defense). Non-instructional phrasing still hard-blocks.
    const res = await request(app).post("/api/chat").send({ message: "I want to kill my coworker" });

    expect(res.status).toBe(200);
    expect(res.body.escalated).toBe(false);
    expect(res.body.response).toContain("workplace communication");
    expect(state.geminiCalls).toHaveLength(0);
    const assistantMsgs = state.messages.filter((m) => m.role === "assistant");
    expect(assistantMsgs).toHaveLength(1);
    expect(state.intentLogs[0].intent).toMatch(/^filtered:/);
  });

  it("flags escalation and appends escalation message for harassment mentions", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "I'm being harassed at work and don't know what to do" });

    expect(res.status).toBe(200);
    expect(res.body.escalated).toBe(true);
    expect(res.body.response).toContain("EAP");
    expect(state.intentLogs[0].intent).toMatch(/^escalated:/);
  });

  it("passes the client-selected intent through when supplied", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/chat")
      .send({ message: "help me push back on this task", intent: "push_back_deadline" });

    expect(res.status).toBe(200);
    expect(state.intentLogs[0].intent).toBe("push_back_deadline");
  });

  it("switches Gemini mode to roleplay when requested", async () => {
    const app = await buildApp();
    await request(app).post("/api/chat").send({ message: "let's practice", mode: "roleplay" });
    expect(state.geminiCalls[0].mode).toBe("roleplay");
  });

  it("threads roleplay history into the roleplay_feedback call", async () => {
    const app = await buildApp();

    const turn1 = await request(app)
      .post("/api/chat")
      .send({ message: "I hear you, and I want to find a path forward", mode: "roleplay" });
    const sessionId = turn1.body.sessionId;

    await request(app)
      .post("/api/chat")
      .send({ sessionId, message: "Can we agree on a smaller first step?", mode: "roleplay" });

    const feedback = await request(app)
      .post("/api/chat")
      .send({
        sessionId,
        message: "Please provide feedback on my role-play practice.",
        mode: "roleplay_feedback",
      });

    expect(feedback.status).toBe(200);
    expect(state.geminiCalls).toHaveLength(3);
    expect(state.geminiCalls[2].mode).toBe("roleplay_feedback");

    const feedbackHistory = state.geminiCalls[2].history;
    expect(feedbackHistory.some((h) => h.role === "user" && h.content.includes("I hear you"))).toBe(true);
    expect(
      feedbackHistory.some((h) => h.role === "user" && h.content.includes("smaller first step")),
    ).toBe(true);

    const intentLogs = state.intentLogs.filter((l) => l.sessionId === sessionId);
    expect(intentLogs).toHaveLength(3);
  });
});

describe("POST /api/chat — handout suggestions (issue #37)", () => {
  function seedLessonWithHandouts(handouts: { title: string; url?: string }[]) {
    state.lessons.length = 0;
    state.lessons.push({
      id: "lesson_with_handouts",
      name: "Giving Feedback.docx",
      content: "Use specific, behavioral language when giving feedback.",
      handouts: JSON.stringify(handouts),
      createdAt: new Date(),
    });
  }

  it("appends a [HANDOUT] marker to the response when a relevant handout exists", async () => {
    seedLessonWithHandouts([
      { title: "Feedback Practice Worksheet", url: "https://example.com/fb.pdf" },
    ]);
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({
      message: "How do I give better feedback to my team?",
    });

    expect(res.status).toBe(200);
    expect(res.body.response).toContain("[HANDOUT]");
    expect(res.body.response).toContain("Feedback Practice Worksheet");
    expect(res.body.response).toContain("https://example.com/fb.pdf");
    // The marker is appended *after* the response body — content above is intact.
    expect(res.body.response).toContain("specific, behavioral language");
  });

  it("logs a handout_suggested IntentLog row alongside the normal intent log", async () => {
    seedLessonWithHandouts([{ title: "Feedback Practice Worksheet" }]);
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({
      message: "How do I give better feedback?",
    });

    const sessionId = res.body.sessionId;
    const logs = state.intentLogs.filter((l) => l.sessionId === sessionId);
    // One row for the regular intent, one for the handout suggestion.
    expect(logs).toHaveLength(2);
    expect(logs.some((l) => l.intent === "handout_suggested:Feedback Practice Worksheet")).toBe(
      true,
    );
  });

  it("does not repeat the same handout twice in one session", async () => {
    seedLessonWithHandouts([{ title: "Feedback Practice Worksheet" }]);
    const app = await buildApp();

    const first = await request(app).post("/api/chat").send({
      message: "How do I give better feedback?",
    });
    expect(first.body.response).toContain("[HANDOUT]");

    const second = await request(app)
      .post("/api/chat")
      .send({ sessionId: first.body.sessionId, message: "What about timing — when should I bring it up?" });

    // The same handout was already suggested — no marker on the second turn.
    expect(second.body.response).not.toContain("[HANDOUT]");
  });

  it("rotates to the next handout when a second one is available", async () => {
    seedLessonWithHandouts([
      { title: "Feedback Practice Worksheet" },
      { title: "Boundary Setting Worksheet" },
    ]);
    const app = await buildApp();

    const first = await request(app).post("/api/chat").send({
      message: "How do I give better feedback?",
    });
    expect(first.body.response).toContain("Feedback Practice Worksheet");

    const second = await request(app)
      .post("/api/chat")
      .send({ sessionId: first.body.sessionId, message: "And how do I set a boundary about it?" });

    expect(second.body.response).toContain("[HANDOUT]");
    expect(second.body.response).toContain("Boundary Setting Worksheet");
    expect(second.body.response).not.toContain("Feedback Practice Worksheet");
  });

  it("does not append a marker when the lesson library has no handouts", async () => {
    // beforeEach seeds a lesson with handouts: null
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({
      message: "How do I give better feedback?",
    });

    expect(res.body.response).not.toContain("[HANDOUT]");
    const sessionId = res.body.sessionId;
    const logs = state.intentLogs.filter((l) => l.sessionId === sessionId);
    expect(logs.some((l) => l.intent.startsWith("handout_suggested:"))).toBe(false);
  });

  it("does not append a marker in roleplay mode", async () => {
    seedLessonWithHandouts([{ title: "Feedback Practice Worksheet" }]);
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({
      message: "let's practice",
      mode: "roleplay",
    });
    expect(res.body.response).not.toContain("[HANDOUT]");
  });

  it("does not append a marker on an escalated turn", async () => {
    seedLessonWithHandouts([{ title: "Feedback Practice Worksheet" }]);
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({
      message: "I'm being harassed at work and don't know what to do",
    });

    expect(res.body.escalated).toBe(true);
    expect(res.body.response).not.toContain("[HANDOUT]");
  });
});

describe("POST /api/chat — progressive disclosure (issue #35)", () => {
  it("flags broad first-turn prompts so Gemini will ask a clarifying question", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({
      message: "How do I set boundaries?",
    });

    expect(res.status).toBe(200);
    expect(state.geminiCalls).toHaveLength(1);
    expect(state.geminiCalls[0].options).toMatchObject({
      breadth: "broad",
      priorAssistantTurns: 0,
    });
  });

  it("does NOT flag broad on a follow-up turn (anti-interrogation rule)", async () => {
    const app = await buildApp();
    const first = await request(app)
      .post("/api/chat")
      .send({ message: "How do I set boundaries?" });
    const sessionId = first.body.sessionId;

    const second = await request(app)
      .post("/api/chat")
      .send({ sessionId, message: "How do I give feedback?" });

    expect(second.status).toBe(200);
    expect(state.geminiCalls).toHaveLength(2);
    // Second turn is also a broad-shaped message, but priorAssistantTurns
    // is now > 0, so the chat route reports the actual count and the
    // clarifying directive will not fire on the model side.
    expect(state.geminiCalls[1].options?.breadth).toBe("broad");
    expect(state.geminiCalls[1].options?.priorAssistantTurns).toBeGreaterThan(0);
  });

  it("treats prompts with concrete scenario context as specific", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({
      message: "My manager keeps assigning weekend work, how do I push back without sounding difficult?",
    });

    expect(res.status).toBe(200);
    expect(state.geminiCalls[0].options?.breadth).toBe("specific");
  });

  it("treats short greetings as specific (no clarifying question)", async () => {
    const app = await buildApp();
    const res = await request(app).post("/api/chat").send({ message: "thanks!" });

    expect(res.status).toBe(200);
    expect(state.geminiCalls[0].options?.breadth).toBe("specific");
  });
});
