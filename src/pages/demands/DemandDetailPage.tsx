import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Ban, Loader2, Pencil, X } from 'lucide-react';
import { ApiError, cancelDemand, getDemand } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  ErrorPanel,
  formatDateOnly,
  formatDateTime,
  inputClass,
  LoadingRows,
  Notice,
  primaryButton,
  secondaryButton,
  StatusBadge,
} from '../../components/ui';
import { FULFILMENT_LABELS, type DemandDetail, type MasterRef } from '../../contracts/demands';

type Result =
  | { key: string; kind: 'ready'; demand: DemandDetail }
  | { key: string; kind: 'error'; message: string; notFound: boolean };

function RefName({ value }: { value: MasterRef }) {
  return (
    <>
      {value.name}
      {!value.active && <span className="ml-1 text-xs text-slate-500">(inactive)</span>}
    </>
  );
}

export function DemandDetailPage() {
  const { id = '' } = useParams();
  const { session, handleApiError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canWrite = session?.user.role === 'OPERATOR';
  const flash = (location.state as { notice?: string } | null)?.notice ?? null;

  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const requestKey = `${id}:${reload}`;

  useEffect(() => {
    const controller = new AbortController();
    getDemand(id, controller.signal)
      .then((demand) => setResult({ key: requestKey, kind: 'ready', demand }))
      .catch((error: unknown) => {
        if (controller.signal.aborted || handleApiError(error)) return;
        setResult({
          key: requestKey,
          kind: 'error',
          message: error instanceof ApiError ? error.message : 'The demand could not be loaded.',
          notFound: error instanceof ApiError && error.status === 404,
        });
      });
    return () => controller.abort();
  }, [id, requestKey, handleApiError]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const loading = result === null || result.key !== requestKey;
  const demand = !loading && result?.kind === 'ready' ? result.demand : null;

  const onCancelled = (updated: DemandDetail) => {
    setCancelOpen(false);
    setResult({ key: requestKey, kind: 'ready', demand: updated });
    setNotice({ kind: 'success', text: `Demand ${updated.code} was cancelled.` });
    // Drop the creation notice from history state so it does not reappear.
    navigate(location.pathname, { replace: true, state: null });
  };

  return (
    <div className="space-y-6">
      <Link
        to="/demands"
        className="inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        ← All demands
      </Link>

      {loading && <LoadingRows label="Loading demand" rows={6} />}
      {!loading && result?.kind === 'error' && (
        <ErrorPanel message={result.message} onRetry={result.notFound ? undefined : refresh} />
      )}

      {demand && (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">{demand.code}</h1>
                {demand.status === 'CANCELLED' ? (
                  <StatusBadge tone="red">Cancelled</StatusBadge>
                ) : (
                  <StatusBadge tone="amber">{FULFILMENT_LABELS[demand.fulfilment]}</StatusBadge>
                )}
              </div>
              {demand.sourceReference && (
                <p className="mt-1 text-sm text-slate-600">{demand.sourceReference}</p>
              )}
            </div>
            {canWrite && demand.status === 'OPEN' && (
              <div className="flex gap-2">
                <Link to={`/demands/${demand.id}/edit`} className={secondaryButton}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setNotice(null);
                    setCancelOpen(true);
                  }}
                  className={`${secondaryButton} text-red-700`}
                >
                  <Ban className="h-4 w-4" aria-hidden="true" />
                  Cancel demand
                </button>
              </div>
            )}
          </header>

          {flash && !notice && <Notice kind="success">{flash}</Notice>}
          {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

          {demand.cancellation && (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="note"
            >
              Cancelled {formatDateTime(demand.cancellation.at)}
              {demand.cancellation.by && ` by ${demand.cancellation.by}`}. Reason:{' '}
              {demand.cancellation.reason}
            </div>
          )}

          <section
            aria-labelledby="demand-details-heading"
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 id="demand-details-heading" className="text-base font-semibold text-slate-900">
              Details
            </h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Demand date">{formatDateOnly(demand.demandDate)}</Field>
              <Field label="Department">
                <RefName value={demand.department} />
              </Field>
              <Field label="Requesting province">
                <RefName value={demand.province} />
              </Field>
              <Field label="Requesting division">
                {demand.division ? <RefName value={demand.division} /> : '—'}
              </Field>
              <Field label="Total quantity">{demand.totalQuantity.toLocaleString()}</Field>
              <Field label="Last updated">{formatDateTime(demand.updatedAt)}</Field>
            </dl>
          </section>

          <section aria-labelledby="demand-lines-heading" className="space-y-3">
            <div>
              <h2 id="demand-lines-heading" className="text-base font-semibold text-slate-900">
                Items ({demand.lineCount})
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Delivered quantities come from dispatch records, which are added in milestone M8.
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <caption className="sr-only">Demand items</caption>
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        #
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Item
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Destination
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Requested
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Delivered
                      </th>
                      <th scope="col" className="px-4 py-3 text-right">
                        Remaining
                      </th>
                      {demand.personalDataVisible && (
                        <th scope="col" className="px-4 py-3">
                          Receiver
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {demand.lines.map((line) => (
                      <tr key={line.id} className="align-top">
                        <td className="px-4 py-3 text-slate-500 tabular-nums">{line.lineNo}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <RefName value={line.item} />
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <RefName value={line.destinationDivision} />
                          {line.destinationDivision.provinceName && (
                            <p className="text-xs text-slate-500">
                              {line.destinationDivision.provinceName}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {line.quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {line.quantityDelivered.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {line.quantityRemaining.toLocaleString()}
                        </td>
                        {demand.personalDataVisible && (
                          <td className="px-4 py-3 text-slate-700">
                            {line.receiverName ?? '—'}
                            {line.receiverPhone && (
                              <p className="text-xs text-slate-500">{line.receiverPhone}</p>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {!demand.personalDataVisible && (
              <p className="text-xs text-slate-500">
                Receiver names and phone numbers are visible to the Production Operator only.
              </p>
            )}
          </section>

          {cancelOpen && session && (
            <CancelDialog
              demand={demand}
              csrfToken={session.csrfToken}
              onClose={() => setCancelOpen(false)}
              onCancelled={onCancelled}
              onApiError={handleApiError}
            />
          )}
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function CancelDialog({
  demand,
  csrfToken,
  onClose,
  onCancelled,
  onApiError,
}: {
  demand: DemandDetail;
  csrfToken: string;
  onClose(): void;
  onCancelled(demand: DemandDetail): void;
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
      onCancelled(
        await cancelDemand(demand.id, { rev: demand.rev, reason: reason.trim() }, csrfToken),
      );
    } catch (err) {
      if (onApiError(err)) return;
      setError(err instanceof ApiError ? err.message : 'The demand could not be cancelled.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        className="relative w-full max-w-md rounded-t-xl bg-white p-6 shadow-xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="cancel-title" className="text-lg font-semibold text-slate-900">
            Cancel {demand.code}?
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
        <p className="mt-2 text-sm text-slate-600">
          The demand is kept for the record but can no longer be changed.
        </p>
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
              Keep demand
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`${primaryButton} bg-red-700 hover:bg-red-800`}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Cancelling…' : 'Cancel demand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
