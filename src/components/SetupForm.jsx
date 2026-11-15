import { ArrowRight, FileText, Loader2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { parseResumePdf } from '../services/api.js';

const EXPERIENCE_LEVELS = [
  { value: 'Intern', hint: 'Student' },
  { value: 'Junior', hint: '0–2 yrs' },
  { value: 'Mid', hint: '2–5 yrs' },
  { value: 'Senior', hint: '5+ yrs' },
];

const INTERVIEW_TYPES = [
  { value: 'HR', hint: 'Culture & fit' },
  { value: 'Technical', hint: 'Systems & code' },
  { value: 'Behavioral', hint: 'STAR stories' },
  { value: 'Mixed', hint: 'Balanced' },
];

const QUESTION_COUNTS = [5, 6, 7, 8, 9, 10];

const SUGGESTED_ROLES = [
  'Frontend Engineer',
  'Backend Python Engineer',
  'Full-Stack Developer',
  'Product Manager',
  'Data Scientist',
];

export function SetupForm({
  user,
  isStarting,
  errorMessage,
  demoMode,
  onStart,
}) {
  const [role, setRole] = useState('Full-Stack Software Engineer');
  const [experienceLevel, setExperienceLevel] = useState('Mid');
  const [interviewType, setInterviewType] = useState('Mixed');
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [jobDescription, setJobDescription] = useState('');

  const [parsedResume, setParsedResume] = useState(null);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [resumeError, setResumeError] = useState(null);
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const fileInputRef = useRef(null);

  const processResumeFile = async (file) => {
    if (!file) return;

    if (!user) {
      setResumeError('Please sign in first to upload and parse a PDF resume.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setResumeError(null);
    setIsParsingResume(true);
    try {
      const parsed = await parseResumePdf(file);
      setParsedResume(parsed);
      setShowResumePreview(false);
    } catch (err) {
      setResumeError(err.message || 'Could not extract text from PDF.');
      setParsedResume(null);
    } finally {
      setIsParsingResume(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    await processResumeFile(file);
  };

  const handleResumeDrop = async (event) => {
    event.preventDefault();
    setIsDragActive(false);
    const file = event.dataTransfer?.files?.[0];
    await processResumeFile(file);
  };

  const handleClearResume = () => {
    setParsedResume(null);
    setResumeError(null);
    setShowResumePreview(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedRole = role.trim();
    if (trimmedRole.length < 2) {
      setValidationError('Please enter a target job role (at least 2 characters).');
      return;
    }
    setValidationError(null);
    await onStart({
      role: trimmedRole,
      experience_level: experienceLevel,
      interview_type: interviewType,
      total_questions: totalQuestions,
      resume_text: parsedResume?.text || undefined,
      job_description: jobDescription.trim() || undefined,
    });
  };

  const activeError = validationError || errorMessage;

  return (
    <section aria-labelledby="setup-heading" className="mx-auto max-w-6xl space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-wide text-emerald-700 dark:text-emerald-400">
            01. Configure  ·  02. Add Context  ·  03. Live Interview
          </p>
          <h1
            id="setup-heading"
            className="mt-2 font-display text-3xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-[2.6rem] sm:leading-[1.1] [text-wrap:balance]"
          >
            Design your next mock interview
          </h1>
          <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            Tailor the role, seniority, and interview style. Answer by typing or voice and receive a competency scorecard with model answers.
          </p>
        </div>

        {demoMode !== null && (
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
            {demoMode ? 'Demo Mode active · No API key required' : 'Live AI Interviewer active'}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {activeError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
          >
            {activeError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Primary Configurator Pane */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-8 space-y-7 lg:col-span-7">
            <div>
              <label
                htmlFor="job-role-input"
                className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100"
              >
                Target Job Role
              </label>
              <input
                id="job-role-input"
                type="text"
                required
                maxLength={120}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Senior Frontend Engineer, Product Manager"
                className="mt-2 block min-h-[48px] w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 px-4 py-3 text-base font-medium text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-700 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTED_ROLES.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRole(preset)}
                    className={`min-h-[34px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                      role === preset
                        ? 'border-zinc-950 bg-zinc-950 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950'
                        : 'border-zinc-200 dark:border-zinc-800 bg-transparent text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-950 dark:hover:text-zinc-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-200/80 dark:border-zinc-800 pt-6">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Experience Level
              </span>
              <div
                role="radiogroup"
                aria-label="Experience level"
                className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
              >
                {EXPERIENCE_LEVELS.map(({ value, hint }) => {
                  const active = experienceLevel === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setExperienceLevel(value)}
                      className={`flex min-h-[56px] flex-col items-start justify-center rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                        active
                          ? 'border-emerald-700 bg-emerald-50/70 dark:border-emerald-400 dark:bg-emerald-950/50'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          active ? 'text-emerald-900 dark:text-emerald-300' : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {value}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-200/80 dark:border-zinc-800 pt-6">
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Interview Focus
              </span>
              <div
                role="radiogroup"
                aria-label="Interview type"
                className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4"
              >
                {INTERVIEW_TYPES.map(({ value, hint }) => {
                  const active = interviewType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setInterviewType(value)}
                      className={`flex min-h-[56px] flex-col items-start justify-center rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                        active
                          ? 'border-emerald-700 bg-emerald-50/70 dark:border-emerald-400 dark:bg-emerald-950/50'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span
                        className={`text-sm font-semibold whitespace-nowrap ${
                          active ? 'text-emerald-900 dark:text-emerald-300' : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {value}
                      </span>
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-200/80 dark:border-zinc-800 pt-6">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="question-count-range"
                  className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  Number of Questions
                </label>
                <span className="font-mono text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-400">
                  {totalQuestions} core questions
                </span>
              </div>

              <div className="mt-3 grid grid-cols-6 gap-2">
                {QUESTION_COUNTS.map((count) => {
                  const active = totalQuestions === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTotalQuestions(count)}
                      aria-pressed={active}
                      className={`min-h-[42px] rounded-xl border font-mono text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                        active
                          ? 'border-zinc-950 bg-zinc-950 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-zinc-950'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600'
                      }`}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>

              <input
                id="question-count-range"
                type="range"
                min={5}
                max={10}
                step={1}
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(Number(e.target.value))}
                aria-label="Number of questions slider"
                className="mt-3 h-2 w-full cursor-pointer accent-emerald-700 dark:accent-emerald-400"
              />
            </div>
          </div>

          {/* Right Context & Launch Rail */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-7 space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="resume-upload-input"
                    className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    Resume PDF
                  </label>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Optional</span>
                </div>

                {!parsedResume ? (
                  <div className="mt-2">
                    <input
                      ref={fileInputRef}
                      id="resume-upload-input"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handleResumeUpload}
                      disabled={isParsingResume}
                      className="sr-only"
                    />
                    <label
                      htmlFor="resume-upload-input"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragActive(true);
                      }}
                      onDragLeave={() => setIsDragActive(false)}
                      onDrop={handleResumeDrop}
                      className={`flex min-h-[104px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-4 text-center transition-colors focus-within:ring-2 focus-within:ring-emerald-700 ${
                        isDragActive
                          ? 'border-emerald-700 bg-emerald-50/70 dark:border-emerald-400 dark:bg-emerald-950/30'
                          : 'border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950/60 hover:border-emerald-700 hover:bg-emerald-50/40 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/20'
                      }`}
                    >
                      {isParsingResume ? (
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                          Extracting text from PDF...
                        </span>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                          <span className="mt-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                            Upload or drop resume (PDF, max 5 MB)
                          </span>
                          <span className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                            {user
                              ? 'Tailors questions to your past experience'
                              : 'Sign in required to upload PDFs'}
                          </span>
                        </>
                      )}
                    </label>
                  </div>
                ) : (
                  <div className="mt-2 border-t border-zinc-200 dark:border-zinc-800 pt-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-100">
                            {parsedResume.filename}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                            {parsedResume.page_count} {parsedResume.page_count === 1 ? 'page' : 'pages'} · {parsedResume.word_count} words extracted
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearResume}
                        aria-label="Remove uploaded resume"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowResumePreview((v) => !v)}
                      className="mt-2 text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded"
                    >
                      {showResumePreview ? 'Hide extracted text' : 'Preview extracted text'}
                    </button>
                    {showResumePreview && (
                      <pre className="mt-2.5 max-h-32 overflow-y-auto whitespace-pre-wrap border-t border-zinc-200 dark:border-zinc-800 pt-2.5 font-sans text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                        {parsedResume.text}
                      </pre>
                    )}
                  </div>
                )}

                {resumeError && (
                  <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
                    {resumeError}{' '}
                    {!user && (
                      <Link to="/login" className="font-semibold underline">
                        Sign in
                      </Link>
                    )}
                  </p>
                )}
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="job-description-input"
                    className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    Job Description
                  </label>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Optional</span>
                </div>
                <textarea
                  id="job-description-input"
                  rows={4}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste key responsibilities, tech stack, or requirements..."
                  className="mt-2 block w-full resize-y rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-700 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>
            </div>

            {/* High-Contrast Session Launch Block */}
            <div className="rounded-2xl bg-zinc-950 p-5 sm:p-6 text-white dark:border dark:border-zinc-800 dark:bg-zinc-900">
              <p className="text-xs font-medium text-zinc-400">
                Session Summary
              </p>
              <p className="mt-1.5 font-display text-lg font-semibold text-white truncate">
                {role.trim() || 'Target Role'}
              </p>
              <p className="mt-1 text-xs text-zinc-300">
                <span>{experienceLevel}</span>
                <span aria-hidden="true"> · </span>
                <span>{interviewType} round</span>
                <span aria-hidden="true"> · </span>
                <span className="font-mono tabular-nums">{totalQuestions} questions</span>
                {parsedResume && (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span>Resume attached</span>
                  </>
                )}
              </p>

              <button
                type="submit"
                disabled={isStarting || isParsingResume}
                className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-60 whitespace-nowrap"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Preparing Interview...
                  </>
                ) : (
                  <>
                    {user ? 'Start Interview' : 'Continue to Sign In & Start'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
