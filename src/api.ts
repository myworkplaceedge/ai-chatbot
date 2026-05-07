import axios from "axios";

// D-13: fail loudly in production builds when VITE_API_URL is unset.
// In dev (PROD === false), fall back to localhost with a console.warn so
// developer ergonomics aren't degraded.
const rawApiUrl = import.meta.env.VITE_API_URL;
if (!rawApiUrl && import.meta.env.PROD) {
  throw new Error(
    "[ai-lesson-coach] VITE_API_URL is not set. Set it in your Vercel environment variables before deploying.",
  );
}
const baseURL = rawApiUrl ?? (() => {
  console.warn(
    "[ai-lesson-coach] VITE_API_URL is not set. Falling back to http://localhost:3000",
  );
  return "http://localhost:3000";
})();

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

const ADMIN_TOKEN_STORAGE_KEY = "adminApiToken";
export const ADMIN_AUTH_EXPIRED_EVENT = "admin-auth-expired";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
}

export function setAdminToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

export const adminApi = axios.create({
  baseURL,
  timeout: 15000,
});

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearAdminToken();
      window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

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
  return adminApi.get<AnalyticsData>("/api/analytics");
}

export type AdminSessionResponse = {
  authenticated: true;
};

export function validateAdminSession(token?: string) {
  return adminApi.get<AdminSessionResponse>("/api/admin/session", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
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
