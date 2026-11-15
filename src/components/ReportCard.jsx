import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { useState } from 'react';

const DIMENSION_META = [
  { key: 'communication', label: 'Communication' },
  { key: 'technical_depth', label: 'Technical Depth' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'relevance', label: 'Relevance' },
];

export function ReportCard({
  session,
  report,
  onStartNew,
  onViewHistory,
  backLabel = 'View History',
}) {
  const [expandedIndex, setExpandedIndex] = useState(0);

  const score = report.overall_score;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  const scoreTone =
    score >= 80
      ? 'text-emerald-400'
      : score >= 65
        ? 'text-teal-300'
        : 'text-amber-400';

  return (
    <section aria-labelledby="report-heading" className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <span>{session.experience_level}</span>
            <span aria-hidden="true"> · </span>
            <span>{session.interview_type} Interview</span>
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">
              {new Date(report.created_at || session.created_at).toLocaleDateString()}
            </span>
          </p>
          <h1
            id="report-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-3xl [text-wrap:balance]"
          >
            {session.role} Evaluation
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <button
            type="button"
            onClick={onViewHistory}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </button>
          <button
            type="button"
            onClick={onStartNew}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-zinc-950 dark:bg-emerald-500 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 whitespace-nowrap"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            New Interview
          </button>
        </div>
      </div>

      {/* Executive Obsidian Scorecard Banner */}
      <div className="grid grid-cols-1 gap-6 rounded-2xl bg-zinc-950 p-6 sm:p-8 text-white dark:border dark:border-zinc-800 dark:bg-zinc-900 lg:grid-cols-12">
        <div className="flex flex-col items-center justify-center border-b border-zinc-800 pb-6 lg:col-span-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
          <div className="relative h-36 w-36">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                strokeWidth="10"
                className="stroke-zinc-800"
              />
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className={`${scoreTone} stroke-current transition-[stroke-dashoffset] duration-700 ease-out`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-3xl font-bold tabular-nums text-white">
                {score}
              </span>
              <span className="text-xs text-zinc-400">out of 100</span>
            </div>
          </div>

          <p className="mt-4 text-sm font-semibold text-zinc-200">
            Recommendation: <span className={scoreTone}>{report.verdict}</span>
          </p>
          <p className="mt-2 text-center text-sm leading-relaxed text-zinc-400">
            {report.summary}
          </p>
        </div>

        <div className="flex flex-col justify-center space-y-5 lg:col-span-8 lg:pl-2">
          <h2 className="font-display text-base font-semibold text-white">
            Competency Breakdown
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {DIMENSION_META.map(({ key, label }) => {
              const val = report.dimensions[key];
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-300">{label}</span>
                    <span className="font-mono font-semibold tabular-nums text-white">
                      {val}/100
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-[width] duration-700 ease-out"
                      style={{ width: `${val}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              Key Strengths
            </h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {report.strengths.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">
              Areas to Strengthen
            </h2>
          </div>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {report.weak_areas.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600 dark:bg-amber-400" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-5 py-4 sm:px-6">
          <h2 className="font-display text-base font-bold text-zinc-950 dark:text-white">
            Question-by-Question Review &amp; Model Answers
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Compare each response against targeted feedback and a high-scoring reference answer.
          </p>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {report.question_breakdown.map((item, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <div key={index}>
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  aria-expanded={isExpanded}
                  className="flex min-h-[56px] w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-700 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Question {item.question_number}
                      {item.is_followup ? ' · Follow-up' : ''}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                      {item.question}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <span className="font-mono text-sm font-bold tabular-nums text-zinc-950 dark:text-white">
                      {item.score}/100
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-400" aria-hidden="true" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-5 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-950/60 px-5 py-5 sm:px-6">
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        Your Answer
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                        {item.user_answer}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 border-t border-zinc-200/80 dark:border-zinc-800 pt-4 md:grid-cols-2 md:gap-8">
                      <div>
                        <h3 className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                          Interviewer Feedback
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                          {item.feedback}
                        </p>
                      </div>

                      <div className="border-t border-zinc-200/80 dark:border-zinc-800 pt-4 md:border-l md:border-t-0 md:pl-8 md:pt-0">
                        <h3 className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                          Model Answer Reference
                        </h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                          {item.model_answer}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
