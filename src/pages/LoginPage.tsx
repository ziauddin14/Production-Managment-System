import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { AlertTriangle, Eye, EyeOff, Info, Loader2, Lock } from 'lucide-react';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import { ApiStatus } from '../components/ApiStatus';
import { FullPageLoader } from '../components/FullPageLoader';

interface FieldErrors {
  username?: string;
  password?: string;
}

export function LoginPage() {
  const { status, notice, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') return <FullPageLoader label="Checking your session…" />;
  if (status === 'authenticated') return <Navigate to={from} replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!username.trim()) errors.username = 'Enter your username.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    setFormError(null);
    if (errors.username || errors.password) return;

    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
      navigate(from, { replace: true });
    } catch (error) {
      setPassword('');
      setFormError(error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (invalid: boolean) =>
    [
      'block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm',
      'placeholder:text-slate-400 focus:outline-none focus:ring-2',
      invalid
        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
        : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-200',
    ].join(' ');

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-900 to-emerald-950 px-4 py-10">
      <div className="mx-auto w-full max-w-md flex-1">
        <div className="mb-8 text-center text-white">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-white text-base font-bold text-emerald-800"
            aria-hidden="true"
          >
            MAB
          </div>
          <h1 className="text-2xl font-semibold">MAB Production Management System</h1>
          <p className="mt-1 text-sm text-emerald-100/80">Donation Box Production Department</p>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-xl sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Lock className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            Sign in
          </h2>

          {notice && !formError && (
            <div
              className="mt-4 flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800"
              role="status"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}
          {formError && (
            <div
              className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <form className="mt-6 space-y-5" onSubmit={onSubmit} noValidate>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={50}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={Boolean(fieldErrors.username)}
                aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                className={`mt-1 ${inputClass(Boolean(fieldErrors.username))}`}
              />
              {fieldErrors.username && (
                <p id="username-error" className="mt-1 text-xs text-red-700">
                  {fieldErrors.username}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  className={`pr-10 ${inputClass(Boolean(fieldErrors.password))}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className="mt-1 text-xs text-red-700">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-xs text-slate-500">
            Accounts are created by the PMS administrator. Contact them if you need access or have
            forgotten your password.
          </p>
        </div>
      </div>

      <footer className="mx-auto mt-8 rounded-full bg-white/95 px-4 py-1.5">
        <ApiStatus />
      </footer>
    </div>
  );
}
