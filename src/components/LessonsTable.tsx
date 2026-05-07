import { lessonVocabularyPdfUrl } from "../api";
import type { Lesson } from "../types";

type LessonsTableProps = {
  lessons: Lesson[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  deletingIds: Set<string>;
};

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <tr key={index} className="border-t border-slate-100">
          <td className="px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
            </div>
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
          </td>
          <td className="px-5 py-4">
            <div className="h-8 w-20 animate-pulse rounded-full bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  );
}

function FileIcon() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand-navy">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
        <path
          d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function LessonsTable({ lessons, isLoading, onDelete, deletingIds }: LessonsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <table className="w-full table-auto border-collapse">
        <thead className="bg-brand-mist/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-5 py-3">Lesson Name</th>
            <th className="px-5 py-3">Uploaded</th>
            <th className="px-5 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <SkeletonRows />
          ) : lessons.length === 0 ? (
            <tr className="border-t border-slate-100">
              <td colSpan={3} className="px-5 py-12 text-center">
                <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-slate-500">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-mist text-brand-navy">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
                      <path
                        d="M12 5v14M5 12h14"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-brand-ink">No lessons yet</p>
                  <p className="text-xs">Upload a .docx file above to see it here.</p>
                </div>
              </td>
            </tr>
          ) : (
            lessons.map((lesson) => (
              <tr
                key={lesson.id}
                className="border-t border-slate-100 text-sm transition hover:bg-brand-mist/40"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3 text-brand-ink">
                    <FileIcon />
                    <span className="font-medium">{lesson.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {new Date(lesson.createdAt).toLocaleString([], {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <a
                      href={lessonVocabularyPdfUrl(lesson.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy transition hover:border-brand-blue/40 hover:bg-brand-light"
                      title="Download a PDF of this lesson's vocabulary"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                        <path
                          d="M12 4v12m0 0-4-4m4 4 4-4M5 19h14"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Vocabulary PDF
                    </a>
                    <button
                      type="button"
                      onClick={() => onDelete(lesson.id)}
                      disabled={deletingIds.has(lesson.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
                        <path
                          d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {deletingIds.has(lesson.id) ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default LessonsTable;
