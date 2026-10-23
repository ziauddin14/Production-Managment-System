import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { ApiError, listAllMasterRecords, listPurchaseOrders } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  ErrorPanel,
  formatDateOnly,
  inputClass,
  LoadingRows,
  primaryButton,
  secondaryButton,
  StatusBadge,
} from '../../components/ui';
import {
  DELIVERY_ROUTE_LABELS,
  PO_COMPLETION_LABELS,
  type DeliveryRoute,
  type PurchaseOrderListResponse,
  type PurchaseOrderSort,
  type PurchaseOrderStatusFilter,
} from '../../contracts/purchaseOrders';
import type { MasterRecord } from '../../contracts/masterData';

const PAGE_SIZE = 25;

type Result =
  | { key: string; kind: 'ready'; data: PurchaseOrderListResponse }
  | { key: string; kind: 'error'; message: string };

export function PurchaseOrdersListPage() {
  const { session, handleApiError } = useAuth();
  const canWrite = session?.user.role === 'OPERATOR';

  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PurchaseOrderStatusFilter>('open');
  const [vendorId, setVendorId] = useState('');
  const [deliveryRoute, setDeliveryRoute] = useState<DeliveryRoute | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<PurchaseOrderSort>('poDate_desc');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [vendors, setVendors] = useState<MasterRecord[]>([]);

  const datesInvalid = Boolean(from && to && from > to);
  const params = { search, status, vendorId, deliveryRoute, from, to, sort, page };
  const requestKey = JSON.stringify({ ...params, reload });

  useEffect(() => {
    if (datesInvalid) return;
    const controller = new AbortController();
    listPurchaseOrders(
      {
        search: search || undefined,
        status,
        vendorId: vendorId || undefined,
        deliveryRoute: deliveryRoute ? (deliveryRoute as DeliveryRoute) : undefined,
        from: from || undefined,
        to: to || undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
      },
      controller.signal,
    )
      .then((data) => setResult({ key: requestKey, kind: 'ready', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted || handleApiError(error)) return;
        setResult({
          key: requestKey,
          kind: 'error',
          message:
            error instanceof ApiError ? error.message : 'Purchase orders could not be loaded.',
        });
      });
    return () => controller.abort();
  }, [
    search,
    status,
    vendorId,
    deliveryRoute,
    from,
    to,
    sort,
    page,
    requestKey,
    datesInvalid,
    handleApiError,
  ]);

  // Load vendors for filter dropdown
  useEffect(() => {
    const controller = new AbortController();
    listAllMasterRecords('vendors', 'all', controller.signal)
      .then(setVendors)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const onSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(searchText.trim());
    setPage(1);
  };

  const resetFilters = useCallback(() => {
    setSearchText('');
    setSearch('');
    setStatus('open');
    setVendorId('');
    setDeliveryRoute('');
    setFrom('');
    setTo('');
    setSort('poDate_desc');
    setPage(1);
  }, []);

  const anyFilters = Boolean(
    search || status !== 'open' || vendorId || deliveryRoute || from || to,
  );
  const total = result?.kind === 'ready' ? result.data.total : null;
  const pageCount = total !== null ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage vendor purchase orders, delivery routes, payment schedules and invoices.
          </p>
        </div>
        {canWrite && (
          <Link to="/purchase-orders/new" className={primaryButton}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New purchase order
          </Link>
        )}
      </div>

      {/* Search and filters */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <form onSubmit={onSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by PO number, code (PO-000001), notes, invoice..."
              className={`${inputClass()} pl-9`}
              aria-label="Search purchase orders"
            />
          </div>
          <button type="submit" className={secondaryButton}>
            Search
          </button>
        </form>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <FilterSelect
            label="Status"
            value={status}
            onChange={(val) => {
              setStatus(val as PurchaseOrderStatusFilter);
              setPage(1);
            }}
          >
            <option value="open">Open</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All statuses</option>
          </FilterSelect>

          <FilterSelect
            label="Vendor"
            value={vendorId}
            onChange={(val) => {
              setVendorId(val);
              setPage(1);
            }}
          >
            <option value="">All vendors</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {!v.active ? ' (inactive)' : ''}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Delivery route"
            value={deliveryRoute}
            onChange={(val) => {
              setDeliveryRoute(val as DeliveryRoute | '');
              setPage(1);
            }}
          >
            <option value="">All routes</option>
            <option value="WAREHOUSE">Warehouse route</option>
            <option value="DIRECT">Direct to division</option>
          </FilterSelect>

          <div>
            <label className="block text-xs font-medium text-slate-600">From date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className={`${inputClass(datesInvalid)} mt-1`}
              aria-label="From date"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600">To date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className={`${inputClass(datesInvalid)} mt-1`}
              aria-label="To date"
            />
          </div>

          <FilterSelect
            label="Sort by"
            value={sort}
            onChange={(val) => {
              setSort(val as PurchaseOrderSort);
              setPage(1);
            }}
          >
            <option value="poDate_desc">Date (newest)</option>
            <option value="poDate_asc">Date (oldest)</option>
            <option value="code_desc">Code (newest)</option>
            <option value="code_asc">Code (oldest)</option>
            <option value="poNumber_asc">PO # (A → Z)</option>
            <option value="poNumber_desc">PO # (Z → A)</option>
          </FilterSelect>
        </div>

        {datesInvalid && (
          <p className="text-xs text-red-600" role="alert">
            "From" date must not be after "To" date.
          </p>
        )}

        {anyFilters && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-emerald-800 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Results table or states */}
      {result === null || result.key !== requestKey ? (
        <LoadingRows label="Loading purchase orders" rows={6} />
      ) : result.kind === 'error' ? (
        <ErrorPanel message={result.message} onRetry={() => setReload((n) => n + 1)} />
      ) : result.data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-900">
            {anyFilters
              ? 'No purchase orders match your filters'
              : 'No purchase orders recorded yet'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {anyFilters
              ? 'Try widening your date range or clearing filters.'
              : canWrite
                ? 'Create a purchase order to start tracking vendor purchases and delivery routes.'
                : 'Purchase orders created by the operator will appear here.'}
          </p>
          {anyFilters ? (
            <button type="button" onClick={resetFilters} className={`${secondaryButton} mt-4`}>
              Clear filters
            </button>
          ) : canWrite ? (
            <Link to="/purchase-orders/new" className={`${primaryButton} mt-4`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New purchase order
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    PO # / PMS Code
                  </th>
                  <th scope="col" className="px-4 py-3">
                    PO Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Vendor
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Delivery Route
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Lines / Qty
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Approved Amount
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Completion
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {result.data.items.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to={`/purchase-orders/${po.id}`}
                        className="text-emerald-800 hover:underline font-semibold"
                      >
                        {po.poNumber}
                      </Link>
                      <div className="text-xs text-slate-500 font-mono">{po.code}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDateOnly(po.poDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">
                      {po.vendor.name}
                      {!po.vendor.active && (
                        <span className="ml-1 text-xs text-amber-700">(inactive)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="font-medium text-slate-900">
                        {DELIVERY_ROUTE_LABELS[po.deliveryRoute]}
                      </div>
                      <div className="text-xs text-slate-500">
                        {po.deliveryRoute === 'WAREHOUSE'
                          ? (po.targetWarehouse?.name ?? '—')
                          : po.destinationDivision
                            ? `${po.destinationDivision.name}${
                                po.destinationDivision.provinceName
                                  ? `, ${po.destinationDivision.provinceName}`
                                  : ''
                              }`
                            : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                      <div>
                        {po.lineCount} {po.lineCount === 1 ? 'line' : 'lines'}
                      </div>
                      <div className="text-xs font-semibold text-slate-900">
                        {po.totalQuantity.toLocaleString()} pcs
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="font-semibold text-slate-900">
                        PKR {po.approvedAmount.toLocaleString()}
                      </div>
                      {po.totalAmount !== po.approvedAmount && (
                        <div
                          className="text-xs text-amber-700"
                          title="Line total differs from approved amount"
                        >
                          Lines: PKR {po.totalAmount.toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge tone={po.status === 'OPEN' ? 'green' : 'grey'}>
                        {po.status === 'OPEN' ? 'Open' : 'Cancelled'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge
                        tone={
                          po.completion === 'COMPLETE'
                            ? 'green'
                            : po.completion === 'PARTIAL'
                              ? 'amber'
                              : 'grey'
                        }
                      >
                        {PO_COMPLETION_LABELS[po.completion]}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <p>
                Showing page <span className="font-semibold text-slate-900">{page}</span> of{' '}
                <span className="font-semibold text-slate-900">{pageCount}</span> ({total} orders)
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={secondaryButton}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className={secondaryButton}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass()} mt-1`}
        aria-label={label}
      >
        {children}
      </select>
    </div>
  );
}
