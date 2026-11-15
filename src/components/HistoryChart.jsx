import { ArrowRight, BarChart3, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchHistory } from '../services/api.js';

const METRIC_OPTIONS = [
  { key: 'overall', label: 'Overall' },
  { key: 'communication', label: 'Communication' },
  { key: 'technical_depth', label: 'Technical Depth' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'relevance', label: 'Relevance' },
];

export function HistoryChart({ onSelectSession, onStartNew, onUnauthorized }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [typeFilter, setTypeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMetric, setActiveMetric] = useState('overall');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const loadHistory = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchHistory();
      setItems(data.history || []);
    } catch (err) {
      if (err.status === 401) {
        onUnauthorized?.();
        return;
      }
      setErrorMessage(err.message || 'Could not load interview history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== 'All' && item.session.interview_type !== typeFilter) return false;
      if (q && !item.session.role.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, typeFilter, searchQuery]);

  const chartPoints = useMemo(() => {
    return [...filteredItems].reverse().map((item, idx) => {
      const score =
        activeMetric === 'overall' ? item.overall_score : item.dimensions[activeMetric];
      return {
        idx,
        item,
        score,
        dateLabel: new Date(item.session.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
      };
    });
  }, [filteredItems, activeMetric]);

  const stats = useMemo(() => {
    if (items.length === 0) {
      return { total: 0, average: 0, best: 0, delta: 0 };
    }
    const scores = items.map((i) => i.overall_score);
    const total = scores.length;
    const average = Math.round(scores.reduce((a, b) => a + b, 0) / total);
    const best = Math.max(...scores);
    const delta = total >= 2 ? scores[0] - scores[1] : 0;
    return { total, average, best, delta };
  }, [items]);

  if (isLoading) {
    return (
      <section aria-label="Loading interview history" className="mx-auto max-w-6xl space-y-6">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((k) => (
            <div
              key={k}
              className="h-24 animate-pulse rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900" />
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="mx-auto max-w-4xl rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-zinc-900 p-8 text-center">
        <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        <button
          type="button"
          onClick={() => void loadHistory()}
          className="mt-4 inline-flex min-h-[40px] items-center rounded-xl bg-zinc-950 dark:bg-emerald-500 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-950"
        >
          Retry
        </button>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300">
          <BarChart3 className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-zinc-950 dark:text-white">
          No completed interviews yet
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Complete your first interview session to track your score trajectory across communication, technical depth, confidence, and relevance.
        </p>
        <button
          type="button"
          onClick={onStartNew}
          className="mt-6 inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-zinc-950 dark:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
        >
          Start Your First Interview
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>
    );
  }

  const svgWidth = 760;
  const svgHeight = 240;
  const padLeft = 40;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const coords = chartPoints.map((pt, i) => {
    const x =
      chartPoints.length === 1
        ? padLeft + plotW / 2
        : padLeft + (i / (chartPoints.length - 1)) * plotW;
    const y = padTop + ((100 - pt.score) / 100) * plotH;
    return { ...pt, x, y };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const activePoint = hoveredIdx !== null ? coords[hoveredIdx] : coords[coords.length - 1];

  return (
    <section aria-labelledby="history-heading" className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            id="history-heading"
            className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-3xl"
          >
            Interview History &amp; Progress
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Review score trends over time and reopen any past evaluation report.
          </p>
        </div>

        <button
          type="button"
          onClick={onStartNew}
          className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-zinc-950 dark:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 whitespace-nowrap shrink-0"
        >
          New Interview
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Completed Sessions</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {stats.total}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Average Score</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {stats.average}
            <span className="text-sm font-normal text-zinc-400">/100</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Best Score</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {stats.best}
            <span className="text-sm font-normal text-zinc-400">/100</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Latest Change</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-zinc-950 dark:text-white">
            {stats.total < 2 ? '—' : `${stats.delta >= 0 ? '+' : ''}${stats.delta}`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              Score Progress Over Time
            </h2>
            {activePoint && (
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                {activePoint.item.session.role} · {activePoint.dateLabel} ·{' '}
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  {activePoint.score}/100
                </span>
              </p>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Chart score metric"
            className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-1"
          >
            {METRIC_OPTIONS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={activeMetric === m.key}
                onClick={() => setActiveMetric(m.key)}
                className={`min-h-[36px] rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  activeMetric === m.key
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {coords.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No sessions match the selected filters.
          </div>
        ) : (
          <div className="mt-5 w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full min-w-[440px] h-auto"
              role="img"
              aria-label="Line chart of interview scores over time"
            >
              <defs>
                <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#047857" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#047857" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {[0, 25, 50, 75, 100].map((tick) => {
                const y = padTop + ((100 - tick) / 100) * plotH;
                return (
                  <g key={tick}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      className="stroke-zinc-200 dark:stroke-zinc-800"
                      strokeWidth="1"
                      strokeDasharray={tick === 0 ? undefined : '4 4'}
                    />
                    <text
                      x={padLeft - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-zinc-400 dark:fill-zinc-500 font-mono text-[11px]"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {areaPath && <path d={areaPath} fill="url(#scoreAreaGrad)" />}

              {coords.length > 1 && (
                <path
                  d={linePath}
                  fill="none"
                  className="stroke-emerald-700 dark:stroke-emerald-400"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {coords.map((pt, i) => {
                const isSelected = hoveredIdx === i;
                return (
                  <g key={pt.item.session.id}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isSelected ? 6 : 4.5}
                      tabIndex={0}
                      role="button"
                      aria-label={`${pt.item.session.role} on ${pt.dateLabel}: ${pt.score} out of 100`}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      onFocus={() => setHoveredIdx(i)}
                      onClick={() => onSelectSession(pt.item)}
                      className="cursor-pointer fill-white dark:fill-zinc-900 stroke-emerald-700 dark:stroke-emerald-400 transition-all focus:outline-none"
                      strokeWidth={isSelected ? 3 : 2.5}
                    />
                    {(coords.length <= 8 || i === 0 || i === coords.length - 1 || i % 2 === 0) && (
                      <text
                        x={pt.x}
                        y={svgHeight - 8}
                        textAnchor="middle"
                        className="fill-zinc-500 dark:fill-zinc-400 text-[11px]"
                      >
                        {pt.dateLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex flex-col gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-1">
            {['All', 'Technical', 'Behavioral', 'HR', 'Mixed'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  typeFilter === t
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by role..."
              aria-label="Filter sessions by role"
              className="min-h-[40px] w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 py-2 pl-9 pr-3 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:border-emerald-700 dark:focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            />
          </div>
        </div>

        {/* Mobile stacked session list */}
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
          {filteredItems.map((item) => (
            <div key={item.session.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-zinc-950 dark:text-white truncate">
                    {item.session.role}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {item.session.interview_type} · {item.session.experience_level} ·{' '}
                    <span className="font-mono tabular-nums">
                      {new Date(item.session.created_at).toLocaleDateString()}
                    </span>
                  </p>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-zinc-950 dark:text-white shrink-0">
                  {item.overall_score}/100
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-zinc-600 dark:text-zinc-300">{item.verdict}</span>
                <button
                  type="button"
                  onClick={() => onSelectSession(item)}
                  className="inline-flex min-h-[38px] items-center text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded whitespace-nowrap"
                >
                  View Report
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop & Tablet table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <th className="px-6 py-3">Role</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3 text-right">Overall</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3 text-right">Date</th>
                <th className="px-6 py-3 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredItems.map((item) => (
                <tr
                  key={item.session.id}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <td className="px-6 py-3 font-semibold text-zinc-950 dark:text-white">
                    {item.session.role}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {item.session.interview_type}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {item.session.experience_level}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-zinc-950 dark:text-white">
                    {item.overall_score}/100
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {item.verdict}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                    {new Date(item.session.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectSession(item)}
                      className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded whitespace-nowrap"
                    >
                      View Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
