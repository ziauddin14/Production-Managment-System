import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { listReceipts } from '../../api';
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
  linkClass,
  LoadingRows,
  Pagination,
  primaryButton,
  RecordStatusBadge,
} from '../../components/ui';
import { LOCATION_KIND_LABELS } from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';

const PAGE_SIZE = 25;

export function ReceiptsListPage() {
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
  const receipts = useResource(
    datesInvalid(filters) ? null : JSON.stringify(params),
    (signal) => listReceipts(params, signal),
    'Receipts could not be loaded.',
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Receiving</h1>
          <p className="mt-1 text-sm text-slate-600">
            Goods received from vendors against purchase orders. Warehouse-route receipts add
            warehouse stock; direct-route receipts are recorded at the destination division.
          </p>
        </div>
        {canWrite && (
          <Link to="/receiving/new" className={primaryButton}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New receipt
          </Link>
        )}
      </div>

      <RecordFilters
        value={filters}
        onChange={(value) => {
          setFilters(value);
          setPage(1);
        }}
        searchLabel="Search receipts"
        searchPlaceholder="Search by receipt code, PO number or vendor challan no."
      />

      {receipts.loading ? (
        <LoadingRows label="Loading receipts" rows={6} />
      ) : receipts.error ? (
        <ErrorPanel message={receipts.error} onRetry={receipts.reload} />
      ) : receipts.data && receipts.data.items.length === 0 ? (
        <EmptyState
          title={filtersActive(filters) ? 'No receipts match your filters' : 'No receipts yet'}
        >
          {filtersActive(filters)
            ? 'Try widening the date range or clearing filters.'
            : canWrite
              ? 'Record a receipt when goods arrive from a vendor.'
              : 'Receipts recorded by the operator will appear here.'}
        </EmptyState>
      ) : receipts.data ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <caption className="sr-only">Goods receipts</caption>
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Receipt
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
                    Received at
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Vendor challan
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Quantity
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {receipts.data.items.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/receiving/${r.id}`} className={linkClass}>
                        {r.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDateOnly(r.receiptDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/purchase-orders/${r.purchaseOrder.id}`} className={linkClass}>
                        {r.purchaseOrder.poNumber}
                      </Link>
                      <div className="font-mono text-xs text-slate-500">{r.purchaseOrder.code}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-900">{r.vendor.name}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.location.name}</div>
                      <div className="text-xs text-slate-500">
                        {LOCATION_KIND_LABELS[r.location.kind]}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.vendorChallanNo ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {r.totalQuantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <RecordStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={receipts.data.total}
            noun="receipts"
            onPage={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
