import { Loader2 } from 'lucide-react';
import { Navigate, useLocation } from 'react-router-dom';

export function ProtectedRoute({ user, isCheckingAuth, notice, children }) {
  const location = useLocation();

  if (isCheckingAuth) {
    return (
      <div className="mx-auto flex max-w-md items-center justify-center py-20 text-sm text-zinc-500 dark:text-zinc-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        Verifying session...
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          authNotice: notice || 'Please sign in or register to access your live interview session.',
        }}
      />
    );
  }

  return children;
}
