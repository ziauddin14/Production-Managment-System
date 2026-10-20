import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { ApiError, listAllMasterRecords, listDemands } from '../../api';
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
  FULFILMENT_LABELS,
  type DemandListResponse,
  type DemandSort,
  type DemandStatusFilter,
} from '../../contracts/demands';
import type { MasterRecord } from '../../contracts/masterData';

const PAGE_SIZE = 25;

type Result =
  | { key: string; kind: 'ready'; data: DemandListResponse }
  | { key: string; kind: 'error'; message: string };

export function DemandsListPage() {
  const { session, handleApiError } = useAuth();
  const canWrite = session?.user.role === 'OPERATOR';

  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DemandStatusFilter>('open');
  const [provinceId, setProvinceId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<DemandSort>('demandDate_desc');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [provinces, setProvinces] = useState<MasterRecord[]>([]);
  const [departments, setDepartments] = useState<MasterRecord[]>([]);

  const datesInvalid = Boolean(from && to && from > to);
  const params = { search, status, provinceId, departmentId, from, to, sort, page };
  const requestKey = JSON.stringify({ ...params, reload });

  useEffect(() => {
    if (datesInvalid) return;
    const controller = new AbortController();
    listDemands(
      {
        search: search || undefined,
        status,
        provinceId: provinceId || undefined,
        departmentId: departmentId || undefined,
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
          message: error instanceof ApiError ? error.message : 'Demands could not be loaded.',
        });
      });
    return () => controller.abort();
  }, [
    search,
    status,
    provinceId,
    departmentId,
    from,
    to,
    sort,
    page,
    requestKey,
    datesInvalid,
    handleApiError,
  ]);

  // Filter options include inactive records, so older demands can still be found.
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      listAllMasterRecords('provinces', 'all', controller.signal),
      listAllMasterRecords('departments', 'all', controller.signal),
    ])
      .then(([p, d]) => {
        setProvinces(p);
        setDepartments(d);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) handleApiError(error);
      });
    return () => controller.abort();
  }, [handleApiError]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const resetPage =
    <T,>(setter: (v: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchText.trim());
    setPage(1);
  };

  const loading = !datesInvalid && (result === null || result.key !== requestKey);
  const data = !loading && !datesInvalid && result?.kind === 'ready' ? result.data : null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(search || provinceId || departmentId || from || to) || status !== 'open';

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Demands</h1>
          <p className="mt-1 text-sm text-slate-600">
            Demands received from provinces, divisions and departments.
          </p>
        </div>
        {canWrite && (
          <Link to="/demands/new" className={primaryButton}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New demand
          </Link>
        )}
      </header>

      <section
        aria-label="Filters"
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <form className="flex gap-2" role="search" onSubmit={onSearch}>
          <label htmlFor="demand-search" className="sr-only">
            Search demands
          </label>
          <input
            id="demand-search"
            type="search"
            placeholder="Search by Demand Number or source reference"
            value={searchText}
            maxLength={100}
            onChange={(e) => setSearchText(e.target.value)}
            className={`min-w-0 flex-1 ${inputClass()}`}
          />
          <button type="submit" className={secondaryButton}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        </form>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Filter label="Status" id="demand-status">
            <select
              id="demand-status"
              value={status}
              onChange={(e) => resetPage(setStatus)(e.target.value as DemandStatusFilter)}
              className={inputClass()}
            >
              <option value="open">Open</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
          </Filter>
          <Filter label="Province" id="demand-province">
            <select
              id="demand-province"
              value={provinceId}
              onChange={(e) => resetPage(setProvinceId)(e.target.value)}
              className={inputClass()}
            >
              <option value="">All provinces</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.active ? p.name : `${p.name} (inactive)`}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Department" id="demand-department">
            <select
              id="demand-department"
              value={departmentId}
              onChange={(e) => resetPage(setDepartmentId)(e.target.value)}
              className={inputClass()}
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.active ? d.name : `${d.name} (inactive)`}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="From" id="demand-from">
            <input
              id="demand-from"
              type="date"
              value={from}
              onChange={(e) => resetPage(setFrom)(e.target.value)}
              aria-invalid={datesInvalid}
              className={inputClass(datesInvalid)}
            />
          </Filter>
          <Filter label="To" id="demand-to">
            <input
              id="demand-to"
              type="date"
              value={to}
              onChange={(e) => resetPage(setTo)(e.target.value)}
              aria-invalid={datesInvalid}
              className={inputClass(datesInvalid)}
            />
          </Filter>
          <Filter label="Sort" id="demand-sort">
            <select
              id="demand-sort"
              value={sort}
              onChange={(e) => resetPage(setSort)(e.target.value as DemandSort)}
              className={inputClass()}
            >
              <option value="demandDate_desc">Newest first</option>
              <option value="demandDate_asc">Oldest first</option>
              <option value="code_desc">Demand Number (high–low)</option>
              <option value="code_asc">Demand Number (low–high)</option>
            </select>
          </Filter>
        </div>
        {datesInvalid && (
          <p className="text-xs text-red-700" role="alert">
            “From” must not be after “To”.
          </p>
        )}
      </section>

      {loading && <LoadingRows label="Loading demands" />}
      {!loading && !datesInvalid && result?.kind === 'error' && (
        <ErrorPanel message={result.message} onRetry={refresh} />
      )}

      {data && data.total === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          {filtered ? 'No demands match these filters.' : 'No demands have been registered yet.'}
          {canWrite && !filtered && ' Use “New demand” to register the first one.'}
        </div>
      )}

      {data && data.total > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">Demands</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Demand
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Province / department
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Lines
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Quantity
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((d) => (
                  <tr key={d.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link
                        to={`/demands/${d.id}`}
                        className="font-medium text-emerald-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        {d.code}
                      </Link>
                      {d.sourceReference && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">
                          {d.sourceReference}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {formatDateOnly(d.demandDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {d.province.name}
                      {d.division && ` · ${d.division.name}`}
                      <p className="text-xs text-slate-500">{d.department.name}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{d.lineCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {d.totalQuantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {d.status === 'CANCELLED' ? (
                        <StatusBadge tone="red">Cancelled</StatusBadge>
                      ) : (
                        <StatusBadge tone="amber">{FULFILMENT_LABELS[d.fulfilment]}</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing {(data.page - 1) * data.pageSize + 1}–
              {Math.min(data.total, data.page * data.pageSize)} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={secondaryButton}
              >
                Previous
              </button>
              <span aria-live="polite">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={secondaryButton}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Filter({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-600">
        {label}
      </label>
      {children}
    </div>
  );
}
