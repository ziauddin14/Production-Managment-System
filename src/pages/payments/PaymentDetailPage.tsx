import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Ban } from 'lucide-react';
import { cancelPayment, getPayment } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { DocumentList } from '../../components/Documents';
import {
  BackLink,
  CancelReasonDialog,
  dangerButton,
  ErrorPanel,
  Field,
  formatDateOnly,
  formatDateTime,
  formatMoney,
  linkClass,
  LoadingRows,
  Notice,
  RecordStatusBadge,
} from '../../components/ui';
import { PAYMENT_METHOD_LABELS } from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';

export function PaymentDetailPage() {
  const { id = '' } = useParams();
  const { session, handleApiError } = useAuth();
  const location = useLocation();
  const flash = (location.state as { notice?: string } | null)?.notice ?? null;
  const canWrite = session?.user.role === 'OPERATOR';
  const payment = useResource(
    `payment:${id}`,
    (signal) => getPayment(id, signal),
    'The payment could not be loaded.',
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const p = payment.data;

  return (
    <div className="space-y-6">
      <BackLink to="/payments">All payments</BackLink>
      {payment.loading && <LoadingRows label="Loading payment" rows={5} />}
      {payment.error && (
        <ErrorPanel
          message={payment.error}
          onRetry={payment.notFound ? undefined : payment.reload}
        />
      )}
      {p && (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{p.code}</h1>
              <RecordStatusBadge status={p.status} />
            </div>
            {canWrite && p.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setCancelOpen(true);
                }}
                className={dangerButton}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                Cancel payment
              </button>
            )}
          </header>
          {flash && !notice && <Notice kind="success">{flash}</Notice>}
          {notice && <Notice kind="success">{notice}</Notice>}
          {p.cancellation && (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="note"
            >
              Cancelled {formatDateTime(p.cancellation.at)}
              {p.cancellation.by && ` by ${p.cancellation.by}`}. Reason: {p.cancellation.reason}
            </div>
          )}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Details</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Amount">{formatMoney(p.amount)}</Field>
              <Field label="Payment date">{formatDateOnly(p.paymentDate)}</Field>
              <Field label="Purchase order">
                <Link to={`/purchase-orders/${p.purchaseOrder.id}`} className={linkClass}>
                  {p.purchaseOrder.poNumber}
                </Link>{' '}
                <span className="font-mono text-xs text-slate-500">{p.purchaseOrder.code}</span>
              </Field>
              <Field label="Vendor">{p.vendor.name}</Field>
              <Field label="Method">{PAYMENT_METHOD_LABELS[p.method]}</Field>
              <Field label="Reference">{p.reference ?? '—'}</Field>
              <Field label="Planned instalment">
                {p.scheduleEntryNo === null ? '—' : `#${p.scheduleEntryNo}`}
              </Field>
              <Field label="Recorded">
                {formatDateTime(p.createdAt)}
                {p.createdBy && ` by ${p.createdBy}`}
              </Field>
              {p.notes && <Field label="Notes">{p.notes}</Field>}
            </dl>
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-500">Supporting documents</h3>
              <div className="mt-1">
                <DocumentList documents={p.documents} />
              </div>
            </div>
          </section>
          {cancelOpen && session && (
            <CancelReasonDialog
              title={`Cancel ${p.code}?`}
              description="The payment is kept for the record but no longer counts towards the purchase order's paid amount."
              keepLabel="Keep payment"
              confirmLabel="Cancel payment"
              onClose={() => setCancelOpen(false)}
              onApiError={handleApiError}
              onConfirm={async (reason) => {
                const updated = await cancelPayment(
                  p.id,
                  { rev: p.rev, reason },
                  session.csrfToken,
                );
                setCancelOpen(false);
                payment.setData(updated);
                setNotice(`Payment ${updated.code} was cancelled.`);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
