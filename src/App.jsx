import { ArrowRight, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthForm } from './components/AuthForm.jsx';
import { ChatInterview } from './components/ChatInterview.jsx';
import { HistoryChart } from './components/HistoryChart.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { ReportCard } from './components/ReportCard.jsx';
import { SetupForm } from './components/SetupForm.jsx';
import {
  checkHealth,
  fetchCurrentUser,
  finishInterview,
  getAuthToken,
  logoutUser,
  setAuthToken,
  startInterview,
  submitAnswer,
} from './services/api.js';

function desktopNavClass({ isActive }) {
  return `whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 dark:focus-visible:ring-emerald-400 rounded py-1 text-sm font-medium ${
    isActive
      ? 'text-zinc-950 dark:text-white underline decoration-emerald-600 dark:decoration-emerald-400 underline-offset-8 decoration-2'
      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
  }`;
}

function mobileNavClass({ isActive }) {
  return `flex min-h-[44px] items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70'
  }`;
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem('ais-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [demoMode, setDemoMode] = useState(null);

  const [pendingConfig, setPendingConfig] = useState(null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [activeTurnKey, setActiveTurnKey] = useState('0');
  const [latestPrompt, setLatestPrompt] = useState('');
  const [report, setReport] = useState(null);
  const [reportSource, setReportSource] = useState('session');

  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem('ais-theme', theme);
  }, [theme]);

  useEffect(() => {
    checkHealth()
      .then((res) => setDemoMode(Boolean(res.demo_mode)))
      .catch(() => setDemoMode(null));

    const token = getAuthToken();
    if (!token) {
      setIsCheckingAuth(false);
      return;
    }

    fetchCurrentUser()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        setAuthToken(null);
        setUser(null);
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  }, []);

  const handleUnauthorized = () => {
    setAuthToken(null);
    setUser(null);
    setSession(null);
    setReport(null);
    setMessages([]);
    navigate('/login', {
      replace: true,
      state: {
        from: location.pathname,
        authNotice: 'Your session expired. Please sign in again to continue.',
      },
    });
  };

  const launchInterview = async (config) => {
    setIsStarting(true);
    setErrorMessage(null);
    try {
      const res = await startInterview(config);
      const firstPrompt = res.greeting?.trim()
        ? `${res.greeting.trim()}\n\n${res.current_turn.question_text}`
        : res.current_turn.question_text;
      setSession(res.session);
      setReport(null);
      setMessages([
        {
          id: `turn-${res.current_turn.id}`,
          sender: 'interviewer',
          text: firstPrompt,
          metaLabel: `Question 1 of ${res.session.total_questions}`,
        },
      ]);
      setActiveTurnKey(`${res.session.id}-1`);
      setLatestPrompt(firstPrompt);
      navigate('/live-session');
    } catch (err) {
      if (err.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(err.message || 'Unable to start interview session.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStartInterview = async (config) => {
    if (!user) {
      setPendingConfig(config);
      navigate('/login', {
        state: {
          from: '/live-session',
          authNotice: 'Please sign in or create an account to start your live interview session.',
        },
      });
      return;
    }
    await launchInterview(config);
  };

  const handleAuthSuccess = async (authenticatedUser, redirectFrom) => {
    setUser(authenticatedUser);
    setErrorMessage(null);

    if (pendingConfig) {
      const configToRun = pendingConfig;
      setPendingConfig(null);
      await launchInterview(configToRun);
      return;
    }

    const target =
      redirectFrom && redirectFrom !== '/login' && redirectFrom !== '/register'
        ? redirectFrom
        : '/';
    navigate(target, { replace: true });
  };

  const handleSignOut = async () => {
    await logoutUser();
    setUser(null);
    setPendingConfig(null);
    setSession(null);
    setReport(null);
    setMessages([]);
    setErrorMessage(null);
    navigate('/login', { replace: true });
  };

  const handleFinishInterview = async (targetSessionId) => {
    const id = targetSessionId || session?.id;
    if (!id) return;

    setIsFinishing(true);
    setErrorMessage(null);
    try {
      const res = await finishInterview(id);
      setSession(res.session);
      setReport(res.report);
      setReportSource('session');
      navigate('/report');
    } catch (err) {
      if (err.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(err.message || 'Could not generate evaluation report.');
    } finally {
      setIsFinishing(false);
    }
  };

  const handleSubmitAnswer = async (answerText, durationSeconds) => {
    if (!session) return;
    setErrorMessage(null);

    const candidateMsg = {
      id: `ans-${Date.now()}`,
      sender: 'candidate',
      text: answerText,
      durationSeconds,
    };
    setMessages((prev) => [...prev, candidateMsg]);
    setIsSubmitting(true);

    try {
      const res = await submitAnswer({
        session_id: session.id,
        answer_text: answerText,
        duration_seconds: durationSeconds,
      });

      setSession(res.session);

      if (res.action === 'complete' || !res.next_turn) {
        const closingMsg = {
          id: `closing-${Date.now()}`,
          sender: 'interviewer',
          text: res.transition,
          metaLabel: 'Wrap-up',
        };
        setMessages((prev) => [...prev, closingMsg]);
        setIsSubmitting(false);
        await handleFinishInterview(res.session.id);
        return;
      }

      const nextPrompt = res.transition?.trim()
        ? `${res.transition.trim()}\n\n${res.next_turn.question_text}`
        : res.next_turn.question_text;
      const label = res.next_turn.is_followup
        ? `Question ${res.next_turn.question_number} · Follow-up`
        : `Question ${res.next_turn.question_number} of ${res.session.total_questions}`;

      const nextMsg = {
        id: `turn-${res.next_turn.id}`,
        sender: 'interviewer',
        text: nextPrompt,
        metaLabel: label,
      };
      setMessages((prev) => [...prev, nextMsg]);
      setActiveTurnKey(`${res.session.id}-${res.next_turn.sequence_number}`);
      setLatestPrompt(nextPrompt);
    } catch (err) {
      if (err.status === 401) {
        handleUnauthorized();
        return;
      }
      setErrorMessage(err.message || 'Failed to submit answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectHistoryItem = (item) => {
    setSession(item.session);
    setReport(item.report);
    setReportSource('history');
    navigate('/report');
  };

  return (
    <div className="min-h-screen bg-[#F6F7F8] text-zinc-950 dark:bg-[#0B0E11] dark:text-zinc-100 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800/90 bg-[#F6F7F8]/95 dark:bg-[#0B0E11]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 sm:gap-8 px-4 sm:px-6">
          <Link
            to="/"
            className="font-display text-base sm:text-lg font-bold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded"
          >
            AI Interview Simulator
          </Link>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-8">
            <NavLink to="/" end className={desktopNavClass}>
              Setup
            </NavLink>
            <NavLink to="/live-session" className={desktopNavClass}>
              Live Session
            </NavLink>
            {user && report && (
              <NavLink to="/report" className={desktopNavClass}>
                Report
              </NavLink>
            )}
            <NavLink to="/history" className={desktopNavClass}>
              History
            </NavLink>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user ? (
              <div className="hidden md:flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 max-w-[140px] truncate">
                  {user.full_name}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex min-h-[40px] items-center rounded-xl bg-zinc-950 dark:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 whitespace-nowrap shrink-0"
              >
                Sign In
              </Link>
            )}

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-panel"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="inline-flex md:hidden h-10 w-10 items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            id="mobile-nav-panel"
            className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 md:hidden"
          >
            <nav aria-label="Mobile navigation" className="space-y-1">
              <NavLink to="/" end className={mobileNavClass}>
                Setup
              </NavLink>
              <NavLink to="/live-session" className={mobileNavClass}>
                Live Session
              </NavLink>
              {user && report && (
                <NavLink to="/report" className={mobileNavClass}>
                  Report
                </NavLink>
              )}
              <NavLink to="/history" className={mobileNavClass}>
                History
              </NavLink>
            </nav>

            {user && (
              <div className="mt-3 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-3">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 truncate pr-3">
                  Signed in as {user.full_name}
                </span>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <Routes>
          <Route
            path="/"
            element={
              <SetupForm
                user={user}
                isStarting={isStarting}
                errorMessage={errorMessage}
                demoMode={demoMode}
                onStart={handleStartInterview}
              />
            }
          />
          <Route path="/setup" element={<Navigate to="/" replace />} />

          <Route
            path="/login"
            element={
              user && !pendingConfig ? (
                <Navigate to={location.state?.from || '/'} replace />
              ) : (
                <AuthForm
                  initialMode="login"
                  demoMode={demoMode}
                  onAuthSuccess={handleAuthSuccess}
                />
              )
            }
          />
          <Route
            path="/register"
            element={
              user && !pendingConfig ? (
                <Navigate to={location.state?.from || '/'} replace />
              ) : (
                <AuthForm
                  initialMode="register"
                  demoMode={demoMode}
                  onAuthSuccess={handleAuthSuccess}
                />
              )
            }
          />

          <Route
            path="/live-session"
            element={
              <ProtectedRoute
                user={user}
                isCheckingAuth={isCheckingAuth}
                notice="Sign in or register to access the Live Session."
              >
                {session && session.status === 'in_progress' ? (
                  <ChatInterview
                    session={session}
                    messages={messages}
                    activeTurnKey={activeTurnKey}
                    latestInterviewerPrompt={latestPrompt}
                    isSubmitting={isSubmitting}
                    isFinishing={isFinishing}
                    errorMessage={errorMessage}
                    onSubmitAnswer={handleSubmitAnswer}
                    onFinishInterview={() => handleFinishInterview(session.id)}
                  />
                ) : (
                  <section className="mx-auto max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 sm:p-10 text-center">
                    <h1 className="font-display text-xl font-bold text-zinc-950 dark:text-white">
                      No active live session
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                      Configure your target role, interview type, and question count to launch a new live interview.
                    </p>
                    <Link
                      to="/"
                      className="mt-6 inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-zinc-950 dark:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                    >
                      Configure Interview
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </section>
                )}
              </ProtectedRoute>
            }
          />

          <Route
            path="/report"
            element={
              <ProtectedRoute
                user={user}
                isCheckingAuth={isCheckingAuth}
                notice="Sign in or register to view interview evaluation reports."
              >
                {session && report ? (
                  <ReportCard
                    session={session}
                    report={report}
                    onStartNew={() => navigate('/')}
                    onViewHistory={() => navigate('/history')}
                    backLabel={reportSource === 'history' ? 'Back to History' : 'View History'}
                  />
                ) : (
                  <Navigate to="/history" replace />
                )}
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute
                user={user}
                isCheckingAuth={isCheckingAuth}
                notice="Sign in or register to view your interview history."
              >
                <HistoryChart
                  onSelectSession={handleSelectHistoryItem}
                  onStartNew={() => navigate('/')}
                  onUnauthorized={handleUnauthorized}
                />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
