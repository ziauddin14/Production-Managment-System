import { useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { Ban } from 'lucide-react';
import { cancelOpeningStock, getOpeningStock } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  BackLink,
  CancelReasonDialog,
  dangerButton,
  ErrorPanel,
  Field,
  formatDateOnly,
  formatDateTime,
  LoadingRows,
  Notice,
  RecordStatusBadge,
} from '../../components/ui';
import { useResource } from '../../hooks/useResource';

export function OpeningStockDetailPage() {
  const { id = '' } = useParams();
  const { session, handleApiError } = useAuth();
  const location = useLocation();
  const flash = (location.state as { notice?: string } | null)?.notice ?? null;
  const canWrite = session?.user.role === 'OPERATOR';
  const entry = useResource(
    `opening-stock:${id}`,
    (signal) => getOpeningStock(id, signal),
    'The opening stock entry could not be loaded.',
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const e = entry.data;

  return (
    <div className="space-y-6">
      <BackLink to="/stock?tab=opening">Opening stock</BackLink>
      {entry.loading && <LoadingRows label="Loading opening stock" rows={6} />}
      {entry.error && (
        <ErrorPanel message={entry.error} onRetry={entry.notFound ? undefined : entry.reload} />
      )}
      {e && (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{e.code}</h1>
              <RecordStatusBadge status={e.status} />
            </div>
            {canWrite && e.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setCancelOpen(true);
                }}
                className={dangerButton}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                Cancel entry
              </button>
            )}
          </header>

          {flash && !notice && <Notice kind="success">{flash}</Notice>}
          {notice && <Notice kind="success">{notice}</Notice>}
          {e.cancellation && (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="note"
            >
              Cancelled {formatDateTime(e.cancellation.at)}
              {e.cancellation.by && ` by ${e.cancellation.by}`}. Reason: {e.cancellation.reason}
            </div>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Details</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Warehouse">{e.warehouse.name}</Field>
              <Field label="Stock date">{formatDateOnly(e.entryDate)}</Field>
              <Field label="Reference">{e.reference ?? '—'}</Field>
              <Field label="Total quantity">{e.totalQuantity.toLocaleString()}</Field>
              <Field label="Recorded">
                {formatDateTime(e.createdAt)}
                {e.createdBy && ` by ${e.createdBy}`}
              </Field>
              {e.notes && (
                <Field label="Notes">
                  <span className="whitespace-pre-wrap">{e.notes}</span>
                </Field>
              )}
            </dl>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Items ({e.lineCount})</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <caption className="sr-only">Opening stock items</caption>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      Line
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Item
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {e.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">#{line.lineNo}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{line.item.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {line.quantity.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {cancelOpen && session && (
            <CancelReasonDialog
              title={`Cancel ${e.code}?`}
              description="The entry is kept for the record and its quantities are taken back out of warehouse stock. If some of this stock has already been dispatched, the server refuses the cancellation."
              keepLabel="Keep entry"
              confirmLabel="Cancel entry"
              onClose={() => setCancelOpen(false)}
              onApiError={handleApiError}
              onConfirm={async (reason) => {
                const updated = await cancelOpeningStock(
                  e.id,
                  { rev: e.rev, reason },
                  session.csrfToken,
                );
                setCancelOpen(false);
                entry.setData(updated);
                setNotice(`Opening stock ${updated.code} was cancelled.`);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
