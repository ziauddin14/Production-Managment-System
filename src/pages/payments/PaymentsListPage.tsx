import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { listPayments } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  datesInvalid,
  DEFAULT_RECORD_FILTERS,
  filtersActive,
  RecordFilters,
  type RecordFilterValue,
} from '../../components/RecordFilters';
import {
  EmptyState,
  ErrorPanel,
  formatDateOnly,
  formatMoney,
  linkClass,
  LoadingRows,
  Pagination,
  primaryButton,
  RecordStatusBadge,
} from '../../components/ui';
import { PAYMENT_METHOD_LABELS } from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';

const PAGE_SIZE = 25;

export function PaymentsListPage() {
  const { session } = useAuth();
  const canWrite = session?.user.role === 'OPERATOR';
  const [filters, setFilters] = useState<RecordFilterValue>(DEFAULT_RECORD_FILTERS);
  const [page, setPage] = useState(1);
  const params = {
    search: filters.search || undefined,
    status: filters.status,
    from: filters.from || undefined,
    to: filters.to || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const payments = useResource(
    datesInvalid(filters) ? null : JSON.stringify(params),
    (signal) => listPayments(params, signal),
    'Payments could not be loaded.',
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor payments</h1>
          <p className="mt-1 text-sm text-slate-600">
            Payments made to vendors against purchase orders. A PO&apos;s outstanding amount is its
            approved amount minus active payments.
          </p>
        </div>
        {canWrite && (
          <Link to="/payments/new" className={primaryButton}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New payment
          </Link>
        )}
      </div>

      <RecordFilters
        value={filters}
        onChange={(value) => {
          setFilters(value);
          setPage(1);
        }}
        searchLabel="Search payments"
        searchPlaceholder="Search by payment code, PO number or reference"
      />

      {payments.loading ? (
        <LoadingRows label="Loading payments" rows={6} />
      ) : payments.error ? (
        <ErrorPanel message={payments.error} onRetry={payments.reload} />
      ) : payments.data && payments.data.items.length === 0 ? (
        <EmptyState
          title={filtersActive(filters) ? 'No payments match your filters' : 'No payments yet'}
        >
          {filtersActive(filters)
            ? 'Try widening the date range or clearing filters.'
            : canWrite
              ? 'Record a payment when a vendor is paid against a purchase order.'
              : 'Payments recorded by the operator will appear here.'}
        </EmptyState>
      ) : payments.data ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <caption className="sr-only">Vendor payments</caption>
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Payment
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Purchase order
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Vendor
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Method / reference
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payments.data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/payments/${p.id}`} className={linkClass}>
                        {p.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDateOnly(p.paymentDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/purchase-orders/${p.purchaseOrder.id}`} className={linkClass}>
                        {p.purchaseOrder.poNumber}
                      </Link>
                      {p.scheduleEntryNo !== null && (
                        <div className="text-xs text-slate-500">
                          Instalment #{p.scheduleEntryNo}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-900">{p.vendor.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {PAYMENT_METHOD_LABELS[p.method]}
                      {p.reference && <div className="text-xs text-slate-500">{p.reference}</div>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums text-slate-900">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <RecordStatusBadge status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={payments.data.total}
            noun="payments"
            onPage={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
