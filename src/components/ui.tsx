import type { ReactNode } from 'react';
import { AlertTriangle, CircleCheck, RefreshCw } from 'lucide-react';

/** Success or error message shown above a page's content. */
export function Notice({ kind, children }: { kind: 'success' | 'error'; children: ReactNode }) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={[
        'flex gap-2 rounded-md border px-4 py-3 text-sm',
        kind === 'error'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900',
      ].join(' ')}
    >
      {kind === 'error' ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center"
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
      <p className="flex-1 text-sm text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  );
}

export function LoadingRows({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div
      className="space-y-2 rounded-lg border border-slate-200 bg-white p-4"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: 'green' | 'grey' | 'amber' | 'red';
  children: ReactNode;
}) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    grey: 'bg-slate-100 text-slate-700 ring-slate-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-800 ring-red-200',
  };
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export const inputClass = (invalid = false) =>
  [
    'block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm',
    'focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500',
    invalid
      ? 'border-red-400 focus:ring-red-200'
      : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-200',
  ].join(' ');

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:opacity-70';

export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Formats a date-only value (YYYY-MM-DD) without shifting it across time zones. */
export function formatDateOnly(value: string): string {
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}

export function formatDateTime(value: string): string {
  return dateTimeFormat.format(new Date(value));
}
