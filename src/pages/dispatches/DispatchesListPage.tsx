import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { listDispatches } from '../../api';
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

export function DispatchesListPage() {
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
  const dispatches = useResource(
    datesInvalid(filters) ? null : JSON.stringify(params),
    (signal) => listDispatches(params, signal),
    'Dispatches could not be loaded.',
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dispatch &amp; Bilty</h1>
          <p className="mt-1 text-sm text-slate-600">
            Goods sent from a warehouse (or from a division that received a direct delivery) to a
            destination division, with Bilty and transport details.
          </p>
        </div>
        {canWrite && (
          <Link to="/dispatches/new" className={primaryButton}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New dispatch
          </Link>
        )}
      </div>

      <RecordFilters
        value={filters}
        onChange={(value) => {
          setFilters(value);
          setPage(1);
        }}
        searchLabel="Search dispatches"
        searchPlaceholder="Search by dispatch code, Bilty no., vehicle or demand code"
      />

      {dispatches.loading ? (
        <LoadingRows label="Loading dispatches" rows={6} />
      ) : dispatches.error ? (
        <ErrorPanel message={dispatches.error} onRetry={dispatches.reload} />
      ) : dispatches.data && dispatches.data.items.length === 0 ? (
        <EmptyState
          title={filtersActive(filters) ? 'No dispatches match your filters' : 'No dispatches yet'}
        >
          {filtersActive(filters)
            ? 'Try widening the date range or clearing filters.'
            : canWrite
              ? 'Record a dispatch when goods leave for a division.'
              : 'Dispatches recorded by the operator will appear here.'}
        </EmptyState>
      ) : dispatches.data ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <caption className="sr-only">Dispatches</caption>
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Dispatch
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    From
                  </th>
                  <th scope="col" className="px-4 py-3">
                    To division
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Demand
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Bilty no.
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
                {dispatches.data.items.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/dispatches/${d.id}`} className={linkClass}>
                        {d.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDateOnly(d.dispatchDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{d.source.name}</div>
                      <div className="text-xs text-slate-500">
                        {LOCATION_KIND_LABELS[d.source.kind]}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{d.destinationDivision.name}</div>
                      {d.destinationDivision.provinceName && (
                        <div className="text-xs text-slate-500">
                          {d.destinationDivision.provinceName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.demand ? (
                        <Link to={`/demands/${d.demand.id}`} className={linkClass}>
                          {d.demand.code}
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{d.biltyNo ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {d.totalQuantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <RecordStatusBadge status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={dispatches.data.total}
            noun="dispatches"
            onPage={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
