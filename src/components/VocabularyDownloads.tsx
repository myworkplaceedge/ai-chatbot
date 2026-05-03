import { useEffect, useState } from "react";
import {
  api,
  getLessonVocabularySummary,
  lessonVocabularyPdfUrl,
} from "../api";
import type { Lesson } from "../types";

type VocabItem = {
  lessonId: string;
  lessonName: string;
  count: number;
};

/**
 * Lists lessons that have a glossary section and offers a one-click PDF
 * download for each. Hidden when no lessons (or no glossaries) are available
 * so the empty state stays clean.
 */
function VocabularyDownloads() {
  const [items, setItems] = useState<VocabItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const lessonsRes = await api.get<Lesson[]>("/api/lessons");
        if (cancelled) return;
        const summaries = await Promise.all(
          lessonsRes.data.map(async (lesson) => {
            try {
              const summary = await getLessonVocabularySummary(lesson.id);
              return summary.data;
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;
        const usable = summaries
          .filter((s): s is NonNullable<typeof s> => s !== null && s.hasVocabulary)
          .map((s) => ({
            lessonId: s.lessonId,
            lessonName: s.lessonName,
            count: s.count,
          }));
        setItems(usable);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading || items.length === 0) return null;

  return (
    <div className="mt-6 w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-soft">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-mist text-brand-navy">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path
              d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path
              d="M9 13h6M9 16h6M9 10h3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <p className="text-sm font-semibold text-brand-ink">Vocabulary cheat sheets</p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Download the glossary from any lesson to study offline.
      </p>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li key={item.lessonId}>
            <a
              href={lessonVocabularyPdfUrl(item.lessonId)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-brand-navy transition hover:border-brand-blue/40 hover:bg-brand-light"
            >
              <span className="min-w-0 truncate font-medium">
                {stripDocxExtension(item.lessonName)}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-brand-blue">
                {item.count} terms
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                  <path
                    d="M12 4v12m0 0-4-4m4 4 4-4M5 19h14"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function stripDocxExtension(name: string): string {
  return name.replace(/\.docx$/i, "");
}

export default VocabularyDownloads;
