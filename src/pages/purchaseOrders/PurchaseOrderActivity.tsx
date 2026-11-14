import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { listPayments, listReceipts } from '../../api';
import {
  formatDateOnly,
  formatMoney,
  linkClass,
  LoadingRows,
  RecordStatusBadge,
} from '../../components/ui';
import { LOCATION_KIND_LABELS, PAYMENT_METHOD_LABELS } from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs"
    >
      <h2
        id={id}
        className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Message({ children, error }: { children: ReactNode; error?: boolean }) {
  return (
    <p
      className={`px-5 py-4 text-sm ${error ? 'text-red-700' : 'text-slate-500'}`}
      role={error ? 'alert' : undefined}
    >
      {children}
    </p>
  );
}

/** Goods receipts recorded against one purchase order (active and cancelled). */
export function PurchaseOrderReceipts({ purchaseOrderId }: { purchaseOrderId: string }) {
  const receipts = useResource(
    `po-receipts:${purchaseOrderId}`,
    (signal) => listReceipts({ purchaseOrderId, status: 'all', pageSize: 100 }, signal),
    'Receipts could not be loaded.',
  );
  return (
    <Panel id="po-receipts-heading" title="Receipts">
      {receipts.loading && <LoadingRows label="Loading receipts" rows={2} />}
      {receipts.error && <Message error>{receipts.error}</Message>}
      {receipts.data && receipts.data.items.length === 0 && (
        <Message>No goods have been received against this purchase order yet.</Message>
      )}
      {receipts.data && receipts.data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <caption className="sr-only">Receipts for this purchase order</caption>
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Receipt
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Date
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Received at
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Quantity
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receipts.data.items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <Link to={`/receiving/${r.id}`} className={linkClass}>
                      {r.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDateOnly(r.receiptDate)}</td>
                  <td className="px-4 py-2.5">
                    {r.location.name}
                    <span className="block text-xs text-slate-500">
                      {LOCATION_KIND_LABELS[r.location.kind]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.totalQuantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <RecordStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** Vendor payments recorded against one purchase order (active and cancelled). */
export function PurchaseOrderPayments({ purchaseOrderId }: { purchaseOrderId: string }) {
  const payments = useResource(
    `po-payments:${purchaseOrderId}`,
    (signal) => listPayments({ purchaseOrderId, status: 'all', pageSize: 100 }, signal),
    'Payments could not be loaded.',
  );
  return (
    <Panel id="po-payments-heading" title="Payments">
      {payments.loading && <LoadingRows label="Loading payments" rows={2} />}
      {payments.error && <Message error>{payments.error}</Message>}
      {payments.data && payments.data.items.length === 0 && (
        <Message>No payments have been recorded for this purchase order yet.</Message>
      )}
      {payments.data && payments.data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <caption className="sr-only">Payments for this purchase order</caption>
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Payment
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Date
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Method
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Amount
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.data.items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5">
                    <Link to={`/payments/${p.id}`} className={linkClass}>
                      {p.code}
                    </Link>
                    {p.scheduleEntryNo !== null && (
                      <span className="block text-xs text-slate-500">
                        Instalment #{p.scheduleEntryNo}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDateOnly(p.paymentDate)}</td>
                  <td className="px-4 py-2.5">
                    {PAYMENT_METHOD_LABELS[p.method]}
                    {p.reference && (
                      <span className="block text-xs text-slate-500">{p.reference}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                    {formatMoney(p.amount)}
                  </td>
                  <td className="px-4 py-2.5">
                    <RecordStatusBadge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
