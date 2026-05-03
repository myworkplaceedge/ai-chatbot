import { useEffect, useState } from "react";
import { getAnalytics, type AnalyticsData } from "../api";

function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string | number;
  Icon: (props: { className?: string }) => JSX.Element;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light text-brand-navy transition group-hover:bg-brand-gradient group-hover:text-white">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-[26px] font-bold tracking-tight text-brand-ink">{value}</p>
    </div>
  );
}

const IconSessions = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path
      d="M21 12c0 4.418-4.03 8-9 8-1.27 0-2.478-.23-3.58-.65L3 21l1.75-4.2C3.64 15.45 3 13.78 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);
const IconMessages = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path d="M4 6h16v10H7l-3 3V6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const IconRatings = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <path
      d="M12 3l2.5 5.2 5.5.8-4 3.9.9 5.6L12 15.9l-4.9 2.6.9-5.6-4-3.9 5.5-.8L12 3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);
const IconSmile = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="9" cy="10.5" r="1" fill="currentColor" />
    <circle cx="15" cy="10.5" r="1" fill="currentColor" />
    <path d="M8.5 14.5c.8 1.2 2 2 3.5 2s2.7-.8 3.5-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

function BarItem({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-sm capitalize text-slate-600" title={label}>
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-gradient transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-sm font-semibold text-brand-ink">{count}</span>
    </div>
  );
}

function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalytics()
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-10 animate-pulse space-y-3">
        <div className="h-6 w-40 rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Unable to load analytics. Make sure the server is running.
      </div>
    );
  }

  const { intentDistribution, lessonPopularity, totalSessions, avgMessagesPerSession, ratingSummary } = data;
  const totalRatings = ratingSummary.thumbs_up + ratingSummary.thumbs_down;
  const satisfactionPct =
    totalRatings > 0 ? Math.round((ratingSummary.thumbs_up / totalRatings) * 100) : 0;

  const intentEntries = Object.entries(intentDistribution).sort((a, b) => b[1] - a[1]);
  const lessonEntries = Object.entries(lessonPopularity).sort((a, b) => b[1] - a[1]);
  const maxIntent = intentEntries.length > 0 ? intentEntries[0][1] : 0;
  const maxLesson = lessonEntries.length > 0 ? lessonEntries[0][1] : 0;

  return (
    <div className="mt-10">
      <h2 className="mb-4 text-lg font-semibold text-brand-ink">Analytics</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Sessions" value={totalSessions} Icon={IconSessions} />
        <StatCard label="Avg Msgs / Session" value={avgMessagesPerSession} Icon={IconMessages} />
        <StatCard label="Total Ratings" value={totalRatings} Icon={IconRatings} />
        <StatCard
          label="Satisfaction"
          value={totalRatings > 0 ? `${satisfactionPct}%` : "N/A"}
          Icon={IconSmile}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {intentEntries.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">Intent Distribution</h3>
            <div className="space-y-2.5">
              {intentEntries.map(([intent, count]) => (
                <BarItem key={intent} label={intent.replace(/_/g, " ")} count={count} max={maxIntent} />
              ))}
            </div>
          </div>
        )}

        {lessonEntries.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h3 className="mb-3 text-sm font-semibold text-brand-ink">Most Used Lessons</h3>
            <div className="space-y-2.5">
              {lessonEntries.map(([lesson, count]) => (
                <BarItem key={lesson} label={lesson} count={count} max={maxLesson} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
