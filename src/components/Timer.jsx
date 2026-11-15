import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

export function Timer({ turnKey, totalSeconds, isPaused = false, onElapsedChange }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    onElapsedChange?.(0);
  }, [turnKey]);

  useEffect(() => {
    if (isPaused) return;
    const interval = window.setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        onElapsedChange?.(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isPaused, turnKey, onElapsedChange]);

  const remaining = Math.max(0, totalSeconds - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const progressPct = totalSeconds > 0 ? Math.max(0, Math.min(100, (remaining / totalSeconds) * 100)) : 0;

  const isLow = remaining > 0 && remaining <= 25;
  const isOvertime = remaining === 0;

  return (
    <div className="space-y-2.5 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Question Timer
        </span>
        <span
          className={`font-mono text-lg font-semibold tabular-nums ${
            isOvertime || isLow
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-zinc-950 dark:text-white'
          }`}
          aria-live="off"
        >
          {formatted}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            isOvertime || isLow
              ? 'bg-amber-500 dark:bg-amber-400'
              : 'bg-emerald-700 dark:bg-emerald-400'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        {isOvertime
          ? 'Suggested time reached — wrap up your thought when ready.'
          : isLow
            ? 'About 25 seconds left — summarize your main takeaway.'
            : 'Take a clear, structured approach to your answer.'}
      </p>
    </div>
  );
}
