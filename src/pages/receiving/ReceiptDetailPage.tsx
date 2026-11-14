import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Ban } from 'lucide-react';
import { cancelReceipt, getReceipt } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  BackLink,
  CancelReasonDialog,
  dangerButton,
  ErrorPanel,
  Field,
  formatDateOnly,
  formatDateTime,
  linkClass,
  LoadingRows,
  Notice,
  RecordStatusBadge,
} from '../../components/ui';
import { LOCATION_KIND_LABELS } from '../../contracts/operations';
import { DELIVERY_ROUTE_LABELS } from '../../contracts/purchaseOrders';
import { useResource } from '../../hooks/useResource';

export function ReceiptDetailPage() {
  const { id = '' } = useParams();
  const { session, handleApiError } = useAuth();
  const location = useLocation();
  const flash = (location.state as { notice?: string } | null)?.notice ?? null;
  const canWrite = session?.user.role === 'OPERATOR';
  const receipt = useResource(
    `receipt:${id}`,
    (signal) => getReceipt(id, signal),
    'The receipt could not be loaded.',
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const r = receipt.data;

  return (
    <div className="space-y-6">
      <BackLink to="/receiving">All receipts</BackLink>
      {receipt.loading && <LoadingRows label="Loading receipt" rows={6} />}
      {receipt.error && (
        <ErrorPanel
          message={receipt.error}
          onRetry={receipt.notFound ? undefined : receipt.reload}
        />
      )}
      {r && (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{r.code}</h1>
              <RecordStatusBadge status={r.status} />
            </div>
            {canWrite && r.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setCancelOpen(true);
                }}
                className={dangerButton}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                Cancel receipt
              </button>
            )}
          </header>

          {flash && !notice && <Notice kind="success">{flash}</Notice>}
          {notice && <Notice kind="success">{notice}</Notice>}
          {r.cancellation && (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="note"
            >
              Cancelled {formatDateTime(r.cancellation.at)}
              {r.cancellation.by && ` by ${r.cancellation.by}`}. Reason: {r.cancellation.reason}
            </div>
          )}

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Details</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Receipt date">{formatDateOnly(r.receiptDate)}</Field>
              <Field label="Purchase order">
                <Link to={`/purchase-orders/${r.purchaseOrder.id}`} className={linkClass}>
                  {r.purchaseOrder.poNumber}
                </Link>{' '}
                <span className="font-mono text-xs text-slate-500">{r.purchaseOrder.code}</span>
              </Field>
              <Field label="Vendor">{r.vendor.name}</Field>
              <Field label="Delivery route">{DELIVERY_ROUTE_LABELS[r.deliveryRoute]}</Field>
              <Field label="Received at">
                {r.location.name}
                <span className="block text-xs font-normal text-slate-500">
                  {LOCATION_KIND_LABELS[r.location.kind]}
                </span>
              </Field>
              <Field label="Vendor challan no.">{r.vendorChallanNo ?? '—'}</Field>
              <Field label="Total quantity">{r.totalQuantity.toLocaleString()}</Field>
              <Field label="Recorded">
                {formatDateTime(r.createdAt)}
                {r.createdBy && ` by ${r.createdBy}`}
              </Field>
              {r.notes && <Field label="Notes">{r.notes}</Field>}
            </dl>
            {r.deliveryRoute === 'DIRECT' && (
              <p className="mt-4 text-xs text-slate-500">
                Direct deliveries are recorded at the division and are not warehouse stock.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Lines ({r.lineCount})</h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <caption className="sr-only">Receipt lines</caption>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      PO line
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
                  {r.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        #{line.poLineNo}
                      </td>
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
              title={`Cancel ${r.code}?`}
              description="The receipt is kept for the record. Its quantities are taken back out of stock and the purchase order's received quantities are reduced. If the goods are no longer in stock (for example, already dispatched), the server refuses the cancellation."
              keepLabel="Keep receipt"
              confirmLabel="Cancel receipt"
              onClose={() => setCancelOpen(false)}
              onApiError={handleApiError}
              onConfirm={async (reason) => {
                const updated = await cancelReceipt(
                  r.id,
                  { rev: r.rev, reason },
                  session.csrfToken,
                );
                setCancelOpen(false);
                receipt.setData(updated);
                setNotice(`Receipt ${updated.code} was cancelled.`);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
