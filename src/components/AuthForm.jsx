import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginUser, registerUser } from '../services/api.js';

export function AuthForm({ initialMode = 'login', demoMode, onAuthSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const authNotice = location.state?.authNotice || null;

  useEffect(() => {
    setMode(initialMode);
    setErrorMessage(null);
  }, [initialMode]);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    navigate(nextMode === 'register' ? '/register' : '/login', {
      replace: true,
      state: location.state,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (mode === 'register') {
      if (fullName.trim().length < 2) {
        setErrorMessage('Please enter your full name (at least 2 characters).');
        return;
      }
      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
    } else if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result =
        mode === 'register'
          ? await registerUser({
              full_name: fullName.trim(),
              email: trimmedEmail,
              password,
            })
          : await loginUser({
              email: trimmedEmail,
              password,
            });
      await onAuthSuccess(result.user, location.state?.from);
    } catch (err) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="auth-heading" className="mx-auto max-w-5xl py-2 sm:py-6 lg:py-8">
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="order-2 flex flex-col justify-between rounded-2xl bg-zinc-950 p-6 sm:p-8 lg:p-10 text-white dark:border dark:border-zinc-800 dark:bg-zinc-900 lg:order-1 lg:col-span-6">
          <div>
            <p className="text-xs font-semibold tracking-wide text-emerald-400">
              Candidate Workspace
            </p>
            <h1
              id="auth-heading"
              className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-4xl [text-wrap:balance]"
            >
              Practice realistic interviews and measure every round
            </h1>
            <p className="mt-3 text-sm sm:text-base leading-relaxed text-zinc-400">
              Sign in or create a candidate profile to launch live interview sessions, review model answers, and track score trends privately.
            </p>
          </div>

          <div className="mt-8 space-y-5 border-t border-zinc-800 pt-6">
            <div>
              <h2 className="text-sm font-semibold text-white">
                01. Concise Conversational Flow
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                One clear question at a time with adaptive follow-ups and optional voice dictation.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                02. Structured Scorecards &amp; History
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                Every completed round generates competency breakdowns, strengths, and progress charts.
              </p>
            </div>
          </div>

          {demoMode !== null && (
            <p className="mt-6 text-xs text-zinc-400">
              {demoMode
                ? 'Demo Mode active · Works immediately without an external AI key'
                : 'Live AI Interviewer active'}
            </p>
          )}
        </div>

        <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col justify-center">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-8">
            <div
              role="tablist"
              aria-label="Authentication mode"
              className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => switchMode('login')}
                className={`min-h-[42px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  mode === 'login'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => switchMode('register')}
                className={`min-h-[42px] rounded-lg px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 ${
                  mode === 'register'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {authNotice && !errorMessage && (
                <div
                  role="status"
                  className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200"
                >
                  {authNotice}
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                >
                  {errorMessage}
                </div>
              )}

              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="auth-fullname"
                    className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    Full Name
                  </label>
                  <input
                    id="auth-fullname"
                    type="text"
                    required
                    autoComplete="name"
                    maxLength={80}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 px-4 py-2.5 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-700 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 px-4 py-2.5 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-700 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                >
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Enter your password'}
                    className="block min-h-[44px] w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 py-2.5 pl-4 pr-11 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-700 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="auth-confirm-password"
                    className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="mt-1.5 block min-h-[44px] w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950 px-4 py-2.5 text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-700 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 dark:bg-emerald-500 px-5 py-3 text-sm font-semibold text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 disabled:opacity-60 whitespace-nowrap"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {mode === 'register' ? 'Creating Account...' : 'Signing In...'}
                  </>
                ) : (
                  <>
                    {mode === 'register' ? 'Create Account' : 'Sign In'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {mode === 'login' ? (
                <>
                  New here?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
