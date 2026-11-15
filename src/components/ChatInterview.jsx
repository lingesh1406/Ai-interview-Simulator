import { ChevronDown, ChevronUp, Flag, Loader2, Send, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Timer } from './Timer.jsx';
import { VoiceControls } from './VoiceControls.jsx';

const INTERVIEWER_AVATAR = '/src/assets/images/interviewer_portrait_1794725976291.jpg';

export function ChatInterview({
  session,
  messages,
  activeTurnKey,
  latestInterviewerPrompt,
  isSubmitting,
  isFinishing,
  errorMessage,
  onSubmitAnswer,
  onFinishInterview,
}) {
  const [draftAnswer, setDraftAnswer] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

  const elapsedRef = useRef(0);
  const scrollEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSubmitting]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeTurnKey]);

  const handleVoiceAppend = (spokenText) => {
    setDraftAnswer((prev) => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed} ${spokenText}` : spokenText;
    });
  };

  const triggerSubmit = async () => {
    const combined = [draftAnswer.trim(), interimTranscript.trim()].filter(Boolean).join(' ').trim();
    if (!combined || isSubmitting || isFinishing) return;

    const spent = elapsedRef.current;
    setDraftAnswer('');
    setInterimTranscript('');
    await onSubmitAnswer(combined, spent);
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    await triggerSubmit();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void triggerSubmit();
    }
  };

  const progressPct = Math.min(
    100,
    Math.round((session.current_question_index / session.total_questions) * 100),
  );

  return (
    <section
      aria-label="Active interview session"
      className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6 items-start"
    >
      <aside className="lg:col-span-4 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 py-4 divide-y divide-zinc-200 dark:divide-zinc-800">
          <div className="space-y-4 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                {!avatarFailed ? (
                  <img
                    src={INTERVIEWER_AVATAR}
                    alt="Senior Hiring Director conducting your interview"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                  />
                ) : (
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    <User className="h-5 w-5" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="font-display text-sm sm:text-base font-bold text-zinc-950 dark:text-white truncate">
                    AI Hiring Director
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {session.role}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {session.experience_level}
                    <span aria-hidden="true"> · </span>
                    {session.interview_type}
                    {session.demo_mode && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>Demo</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileToolsOpen((prev) => !prev)}
                aria-expanded={mobileToolsOpen}
                className="inline-flex lg:hidden min-h-[40px] items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
              >
                Controls
                {mobileToolsOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-600 dark:text-zinc-400">
                  Interview Progress
                </span>
                <span className="font-mono font-semibold tabular-nums text-zinc-950 dark:text-white">
                  Question {session.current_question_index} of {session.total_questions}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-700 dark:bg-emerald-400 transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className={`${mobileToolsOpen ? 'block' : 'hidden'} lg:block divide-y divide-zinc-200 dark:divide-zinc-800`}>
            <Timer
              turnKey={activeTurnKey}
              totalSeconds={session.seconds_per_question}
              isPaused={isSubmitting || isFinishing}
              onElapsedChange={(secs) => {
                elapsedRef.current = secs;
              }}
            />

            <VoiceControls
              latestPrompt={latestInterviewerPrompt}
              promptKey={activeTurnKey}
              disabled={isSubmitting || isFinishing}
              onTranscriptAppend={handleVoiceAppend}
              onInterimChange={setInterimTranscript}
            />

            <div className="pt-4">
              {!confirmEnd ? (
                <button
                  type="button"
                  onClick={() => setConfirmEnd(true)}
                  disabled={isFinishing}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-transparent px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                  End &amp; Generate Report
                </button>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-zinc-700 dark:text-zinc-300">
                    Finish the interview now and score your answers so far?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmEnd(false);
                        void onFinishInterview();
                      }}
                      disabled={isFinishing}
                      className="flex-1 min-h-[40px] rounded-xl bg-zinc-950 dark:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-emerald-400"
                    >
                      {isFinishing ? 'Scoring...' : 'Confirm Finish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmEnd(false)}
                      className="min-h-[40px] rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 lg:col-span-8 min-h-[460px] sm:min-h-[540px] lg:h-[calc(100vh-9.5rem)] lg:max-h-[780px]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3.5 sm:px-6">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Interview Room
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {session.has_resume ? 'Resume loaded' : 'Standard prompt'}
            {session.has_job_description ? ' · JD matched' : ''}
          </span>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6" aria-live="polite">
          {messages.map((msg) => {
            const isInterviewer = msg.sender === 'interviewer';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isInterviewer ? 'items-start' : 'items-end'}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {isInterviewer ? 'Interviewer' : 'You'}
                  </span>
                  {msg.metaLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{msg.metaLabel}</span>
                    </>
                  )}
                  {typeof msg.durationSeconds === 'number' && msg.durationSeconds > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{msg.durationSeconds}s</span>
                    </>
                  )}
                </div>
                <div
                  className={`max-w-[92%] sm:max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    isInterviewer
                      ? 'border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100'
                      : 'bg-zinc-950 text-white dark:bg-emerald-500 dark:text-zinc-950 font-medium'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}

          {(isSubmitting || isFinishing) && (
            <div className="flex items-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-300">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                {isFinishing
                  ? 'Evaluating your interview and compiling model answers...'
                  : 'Reviewing your answer...'}
              </div>
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        <form
          onSubmit={handleFormSubmit}
          className="border-t border-zinc-200 dark:border-zinc-800 p-4 sm:p-5"
        >
          {errorMessage && (
            <div
              role="alert"
              className="mb-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-3.5 py-2 text-xs text-red-700 dark:text-red-300"
            >
              {errorMessage}
            </div>
          )}

          {interimTranscript && (
            <p className="mb-2 text-xs italic text-zinc-500 dark:text-zinc-400">
              Dictating: {interimTranscript}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="candidate-answer-input" className="sr-only">
                Your interview answer
              </label>
              <textarea
                ref={textareaRef}
                id="candidate-answer-input"
                rows={3}
                value={draftAnswer}
                onChange={(e) => setDraftAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting || isFinishing}
                placeholder="Type your response or use Answer by Voice... (Enter to submit, Shift+Enter for new line)"
                className="block w-full resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-700 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={(!draftAnswer.trim() && !interimTranscript.trim()) || isSubmitting || isFinishing}
              className="inline-flex min-h-[46px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-zinc-950 dark:bg-emerald-500 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Submit Answer
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
