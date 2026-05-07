import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import {
  ADMIN_AUTH_EXPIRED_EVENT,
  adminApi,
  api,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
  validateAdminSession,
} from "../api";
import UploadZone from "../components/UploadZone";
import LessonsTable from "../components/LessonsTable";
import Toast from "../components/Toast";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
import type { Lesson, ToastType } from "../types";
import logo from "../assets/workplace-edge-logo.svg";

type ToastState = {
  message: string;
  type: ToastType;
} | null;

type LockedAdminScreenProps = {
  tokenInput: string;
  authError: string | null;
  isValidatingToken: boolean;
  onTokenChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function LockedAdminScreen({
  tokenInput,
  authError,
  isValidatingToken,
  onTokenChange,
  onSubmit,
}: LockedAdminScreenProps) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-navy">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path
                d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6V10Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
              Admin Access
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-ink">
              Unlock Admin Panel
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter the admin API token to manage lessons and view analytics.
            </p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-brand-ink">Admin token</span>
            <input
              type="password"
              value={tokenInput}
              onChange={(event) => onTokenChange(event.target.value)}
              autoComplete="off"
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-brand-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
              placeholder="Paste admin token"
            />
          </label>

          {authError && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {authError}
            </p>
          )}

          <button
            type="submit"
            disabled={isValidatingToken}
            className={clsx(
              "inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition",
              isValidatingToken
                ? "cursor-wait bg-slate-200 text-slate-500"
                : "bg-brand-gradient text-white shadow-soft hover:shadow-lift",
            )}
          >
            {isValidatingToken ? "Checking..." : "Unlock Admin"}
          </button>
        </form>
      </div>
    </section>
  );
}

function AdminPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState>(null);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => Boolean(getAdminToken()));
  const [tokenInput, setTokenInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(false);

  const resetAdminState = useCallback(() => {
    setIsAdminUnlocked(false);
    setSelectedFile(null);
    setLessons([]);
    setIsLoadingLessons(false);
    setIsUploading(false);
    setDeletingIds(new Set());
  }, []);

  const lockAdmin = useCallback(() => {
    clearAdminToken();
    resetAdminState();
    setTokenInput("");
  }, [resetAdminState]);

  const loadLessons = useCallback(async () => {
    setIsLoadingLessons(true);
    try {
      const response = await api.get<Lesson[]>("/api/lessons");
      setLessons(response.data);
    } catch {
      setToast({ type: "error", message: "Failed to load lessons" });
    } finally {
      setIsLoadingLessons(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdminUnlocked) return;
    void loadLessons();
  }, [isAdminUnlocked, loadLessons]);

  useEffect(() => {
    const handleAuthExpired = () => {
      if (!isAdminUnlocked) return;
      lockAdmin();
      setAuthError("Admin session expired. Enter the token again.");
      setToast({ type: "error", message: "Admin session expired" });
    };

    window.addEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(ADMIN_AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [isAdminUnlocked, lockAdmin]);

  const handleUnlockAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = tokenInput.trim();

    if (!token) {
      setAuthError("Enter the admin token.");
      return;
    }

    setIsValidatingToken(true);
    setAuthError(null);

    try {
      await validateAdminSession(token);
      setAdminToken(token);
      setIsAdminUnlocked(true);
      setTokenInput("");
    } catch {
      clearAdminToken();
      setIsAdminUnlocked(false);
      setAuthError("Invalid admin token.");
    } finally {
      setIsValidatingToken(false);
    }
  };

  const handleLockAdmin = () => {
    lockAdmin();
    setAuthError(null);
  };

  const uploadLesson = async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      await adminApi.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setToast({ type: "success", message: "Lesson uploaded successfully" });
      setSelectedFile(null);
      await loadLessons();
    } catch {
      setToast({ type: "error", message: "Upload failed. Please try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteLesson = async (id: string) => {
    if (deletingIds.has(id)) return;

    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await adminApi.delete(`/api/lessons/${id}`);
      setLessons((prev) => prev.filter((lesson) => lesson.id !== id));
      setToast({ type: "success", message: "Lesson deleted successfully" });
    } catch {
      setToast({ type: "error", message: "Failed to delete lesson" });
    } finally {
      setDeletingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(id);
        return copy;
      });
    }
  };

  return (
    <main className="min-h-screen text-brand-ink">
      <nav className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Workplace Edge" className="h-10 w-auto" />
            <div className="hidden h-8 w-px bg-slate-200 sm:block" />
            <div className="hidden sm:block">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
                Admin Panel
              </p>
              <p className="text-xs text-slate-500">Manage lessons and view learner analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdminUnlocked && (
              <button
                type="button"
                onClick={handleLockAdmin}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-soft transition hover:border-rose-200 hover:text-rose-600"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                  <path
                    d="M7 10V8a5 5 0 0 1 10 0v2M6 10h12v10H6V10Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Lock Admin
              </button>
            )}
            <Link
              to="/chat"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-soft transition hover:border-brand-blue/30 hover:text-brand-navy"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                <path
                  d="M21 11.5c0 4.142-4.03 7.5-9 7.5a11 11 0 0 1-3.06-.424L4 20l1.22-3.66A7.06 7.06 0 0 1 3 11.5C3 7.358 7.03 4 12 4s9 3.358 9 7.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
              Open Coach
            </Link>
          </div>
        </div>
      </nav>

      {isAdminUnlocked ? (
        <section className="mx-auto w-full max-w-5xl px-4 py-10">
          <header>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-blue">
              Content
            </p>
            <h1 className="mt-1 text-[28px] font-bold tracking-tight text-brand-ink">
              Lesson Content Manager
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-500">
              Upload Word documents to ground the AI coach, then review which lessons learners interact with most.
            </p>
          </header>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-navy">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                  <path
                    d="M12 15V5m0 0-4 4m4-4 4 4M5 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-brand-ink">Upload Lesson Plan</h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Upload a Word document to process and store lesson content.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <UploadZone file={selectedFile} onFileSelect={setSelectedFile} />
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={uploadLesson}
                disabled={!selectedFile || isUploading}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition",
                  selectedFile && !isUploading
                    ? "bg-brand-gradient text-white shadow-soft hover:shadow-lift"
                    : "cursor-not-allowed bg-slate-200 text-slate-500",
                )}
              >
                {isUploading ? (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" aria-hidden>
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                      <path
                        d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Upload Lesson
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-10">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-brand-ink">Uploaded Lessons</h2>
              <span className="text-xs text-slate-500">
                {isLoadingLessons ? "Loading..." : `${lessons.length} total`}
              </span>
            </div>
            <LessonsTable
              lessons={lessons}
              isLoading={isLoadingLessons}
              onDelete={deleteLesson}
              deletingIds={deletingIds}
            />
          </div>

          <AnalyticsDashboard />
        </section>
      ) : (
        <LockedAdminScreen
          tokenInput={tokenInput}
          authError={authError}
          isValidatingToken={isValidatingToken}
          onTokenChange={setTokenInput}
          onSubmit={handleUnlockAdmin}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </main>
  );
}

export default AdminPage;
