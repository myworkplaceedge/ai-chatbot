import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

export type ChatRequestBody = {
  sessionId?: string;
  message: string;
  intent?: string;
  mode?: "roleplay" | "roleplay_feedback";
};

export type ChatResponse = {
  sessionId: string;
  response: string;
  messageId: string;
  escalated?: boolean;
};

export function postChat(body: ChatRequestBody, options?: { timeoutMs?: number }) {
  return api.post<ChatResponse>("/api/chat", body, {
    timeout: options?.timeoutMs,
  });
}

export function rateMessage(messageId: string, value: "thumbs_up" | "thumbs_down") {
  return api.post("/api/rating", { messageId, value });
}

export type AnalyticsData = {
  intentDistribution: Record<string, number>;
  lessonPopularity: Record<string, number>;
  totalSessions: number;
  avgMessagesPerSession: number;
  ratingSummary: { thumbs_up: number; thumbs_down: number };
};

export function getAnalytics() {
  return api.get<AnalyticsData>("/api/analytics");
}

export type LessonVocabularySummary = {
  lessonId: string;
  lessonName: string;
  count: number;
  hasVocabulary: boolean;
};

export function getLessonVocabularySummary(lessonId: string) {
  return api.get<LessonVocabularySummary>(`/api/lessons/${lessonId}/vocabulary`);
}

/**
 * Build the absolute URL for a lesson's vocabulary PDF. Used as an `<a href>`
 * target so the browser handles the download natively (preserving filename
 * from Content-Disposition).
 */
export function lessonVocabularyPdfUrl(lessonId: string): string {
  return `${baseURL}/api/lessons/${lessonId}/vocabulary.pdf`;
}
