import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CircleAlert, CircleCheck, Clock, Eye, RefreshCw } from 'lucide-react';
import { ApiError, getDashboardSummary } from '../api';
import { useAuth } from '../auth/AuthContext';
import { ROLE_LABELS } from '../contracts/auth';
import type { DashboardIndicator, DashboardSummary } from '../contracts/dashboard';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; summary: DashboardSummary };

const timeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function IndicatorCard({ indicator }: { indicator: DashboardIndicator }) {
  const available = indicator.status === 'available' && indicator.value !== null;
  return (
    <article
      className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby={`indicator-${indicator.key}`}
    >
      <h3 id={`indicator-${indicator.key}`} className="text-sm font-medium text-slate-600">
        {indicator.label}
      </h3>
      {available ? (
        <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
          {indicator.value?.toLocaleString()}
        </p>
      ) : (
        <p className="mt-2">
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
            Not available yet
          </span>
        </p>
      )}
      <p className="mt-3 text-sm text-slate-500">{indicator.description}</p>
      {!available && indicator.plannedMilestone && (
        <p className="mt-auto pt-4 text-xs text-slate-500">
          Available after{' '}
          <span className="font-medium text-slate-700">{indicator.plannedMilestone}</span>
        </p>
      )}
    </article>
  );
}

function LoadingCards() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Loading indicators"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-lg border border-slate-200 bg-white p-5">
          <div className="h-3 w-1/2 rounded bg-slate-200" />
          <div className="mt-4 h-6 w-1/3 rounded bg-slate-200" />
          <div className="mt-4 h-3 w-3/4 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { session, handleApiError } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getDashboardSummary(controller.signal)
      .then((summary) => setState({ kind: 'ready', summary }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (handleApiError(error)) return;
        setState({
          kind: 'error',
          message: error instanceof ApiError ? error.message : 'The dashboard could not be loaded.',
        });
      });
    return () => controller.abort();
  }, [attempt, handleApiError]);

  const user = session?.user;
  const readOnly = user?.role === 'VIEWER';

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          {user && (
            <p className="mt-1 text-sm text-slate-600">
              Welcome, {user.displayName} · {ROLE_LABELS[user.role]}
            </p>
          )}
        </div>
        {state.kind === 'ready' && (
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Updated {timeFormat.format(new Date(state.summary.generatedAt))}
          </p>
        )}
      </header>

      {readOnly && (
        <div
          className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
          role="note"
        >
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            You have read-only access. Operational changes are made by the Production Operator.
          </span>
        </div>
      )}

      <section aria-labelledby="indicators-heading" className="space-y-4">
        <div>
          <h2 id="indicators-heading" className="text-base font-semibold text-slate-900">
            Production overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Figures appear here as each module is delivered. No data is shown until it exists in
            PMS.
          </p>
        </div>

        {state.kind === 'loading' && <LoadingCards />}

        {state.kind === 'error' && (
          <div
            className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center"
            role="alert"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            <p className="flex-1 text-sm text-red-800">{state.message}</p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {state.kind === 'ready' && state.summary.indicators.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No indicators are configured yet.
          </div>
        )}

        {state.kind === 'ready' && state.summary.indicators.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {state.summary.indicators.map((indicator) => (
              <IndicatorCard key={indicator.key} indicator={indicator} />
            ))}
          </div>
        )}
      </section>

      {state.kind === 'ready' && (
        <section
          aria-labelledby="system-heading"
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 id="system-heading" className="text-base font-semibold text-slate-900">
            System status
          </h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">Database</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-medium">
                {state.summary.system.database === 'up' ? (
                  <>
                    <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <span className="text-emerald-800">Connected</span>
                  </>
                ) : (
                  <>
                    <CircleAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    <span className="text-amber-800">Unavailable</span>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Signed in as</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {state.summary.user.username} ({state.summary.user.code})
              </dd>
            </div>
            {session && (
              <div>
                <dt className="text-slate-500">Session ends</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {timeFormat.format(new Date(session.expiresAt))}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}
