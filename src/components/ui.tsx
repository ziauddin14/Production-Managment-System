import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CircleCheck, Loader2, RefreshCw, X } from 'lucide-react';
import { ApiError } from '../api';

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

const moneyFormat = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats an amount in Pakistani rupees with two decimals, e.g. "PKR 1,250.00". */
export function formatMoney(value: number): string {
  return `PKR ${moneyFormat.format(value)}`;
}

export const dangerButton =
  'inline-flex items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60';

export const linkClass =
  'font-medium text-emerald-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';

/** "← label" link back to a list or parent record. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 print:hidden"
    >
      ← {children}
    </Link>
  );
}

/** Active / cancelled badge for receipts, dispatches and payments. */
export function RecordStatusBadge({ status }: { status: 'ACTIVE' | 'CANCELLED' }) {
  return status === 'ACTIVE' ? (
    <StatusBadge tone="green">Active</StatusBadge>
  ) : (
    <StatusBadge tone="red">Cancelled</StatusBadge>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

/** Field-level validation message, linked to its input with `aria-describedby`. */
export function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-700">
      {message}
    </p>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  noun,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  onPage(page: number): void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between print:hidden"
    >
      <p>
        Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
        <span className="font-semibold text-slate-900">{pageCount}</span> ({total} {noun})
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(Math.max(1, page - 1))}
          className={secondaryButton}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          className={secondaryButton}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

/**
 * Confirmation dialog that asks for a cancellation reason (kept on the record for the audit
 * trail) and runs `onConfirm`. Errors from the server are shown inside the dialog.
 */
export function CancelReasonDialog({
  title,
  description,
  keepLabel,
  confirmLabel,
  onClose,
  onConfirm,
  onApiError,
}: {
  title: string;
  description: ReactNode;
  keepLabel: string;
  confirmLabel: string;
  onClose(): void;
  onConfirm(reason: string): Promise<void>;
  onApiError(error: unknown): boolean;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError('Enter a reason for cancelling.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      if (onApiError(err)) return;
      setError(
        err instanceof ApiError
          ? err.status === 409
            ? 'This record was changed by someone else. Close this dialog and reload the page.'
            : err.message
          : 'The record could not be cancelled.',
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center print:hidden">
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        className="relative w-full max-w-md rounded-t-xl bg-white p-6 shadow-xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="cancel-dialog-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2 text-sm text-slate-600">{description}</div>
        <form className="mt-4 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label htmlFor="cancel-reason" className="block text-sm font-medium text-slate-700">
              Reason
            </label>
            <textarea
              id="cancel-reason"
              autoFocus
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'cancel-error' : undefined}
              className={`mt-1 ${inputClass(Boolean(error))}`}
            />
            {error && (
              <p id="cancel-error" className="mt-1 text-xs text-red-700" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={saving} className={secondaryButton}>
              {keepLabel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`${primaryButton} bg-red-700 hover:bg-red-800`}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Cancelling…' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Maps server validation `details` to a { path: message } record. */
export function detailsToFieldErrors(error: ApiError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of error.details) if (!map[d.path]) map[d.path] = d.message;
  return map;
}

/** Simple label + value pair inside a `<dl>`. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{children}</dd>
    </div>
  );
}
