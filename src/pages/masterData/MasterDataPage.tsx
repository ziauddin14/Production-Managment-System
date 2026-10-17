import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { NavLink, Navigate, useParams } from 'react-router';
import { AlertTriangle, CircleCheck, Eye, Pencil, Plus, RefreshCw, Search } from 'lucide-react';
import { ApiError, listMasterRecords, updateMasterRecord } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  MASTER_ENTITY_META,
  masterEntityKeys,
  type MasterEntityKey,
  type MasterListResponse,
  type MasterRecord,
  type MasterStatusFilter,
} from '../../contracts/masterData';
import { NotFoundPage } from '../NotFoundPage';
import { MasterRecordDialog } from './MasterRecordDialog';

const PAGE_SIZE = 25;

function isEntity(value: string | undefined): value is MasterEntityKey {
  return (masterEntityKeys as readonly string[]).includes(value ?? '');
}

export function MasterDataPage() {
  const { entity } = useParams();
  if (entity === undefined) return <Navigate to="/master-data/provinces" replace />;
  if (!isEntity(entity)) return <NotFoundPage />;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Master data</h1>
        <p className="mt-1 text-sm text-slate-600">
          Reference lists used by demands, purchase orders, stock and dispatch.
        </p>
      </header>
      <nav aria-label="Master data lists" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-1 border-b border-slate-200">
          {masterEntityKeys.map((key) => (
            <li key={key}>
              <NavLink
                to={`/master-data/${key}`}
                className={({ isActive }) =>
                  [
                    'inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                    isActive
                      ? 'border-emerald-700 text-emerald-800'
                      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900',
                  ].join(' ')
                }
              >
                {MASTER_ENTITY_META[key].label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      {/* Keyed by entity so filters, paging and dialogs reset when switching lists. */}
      <MasterList key={entity} entity={entity} />
    </div>
  );
}

type Notice = { kind: 'success' | 'error'; text: string } | null;
type Result =
  | { key: string; kind: 'ready'; data: MasterListResponse }
  | { key: string; kind: 'error'; message: string };
type Dialog = { mode: 'create' } | { mode: 'edit'; record: MasterRecord } | null;

function MasterList({ entity }: { entity: MasterEntityKey }) {
  const { session, handleApiError } = useAuth();
  const meta = MASTER_ENTITY_META[entity];
  const canWrite = session?.user.role === 'OPERATOR';
  const csrfToken = session?.csrfToken ?? '';

  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<MasterStatusFilter>('active');
  const [provinceId, setProvinceId] = useState('');
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<MasterRecord[]>([]);

  const requestKey = JSON.stringify({ entity, search, status, provinceId, page, reload });

  useEffect(() => {
    const controller = new AbortController();
    listMasterRecords(
      entity,
      { search, status, page, pageSize: PAGE_SIZE, provinceId: provinceId || undefined },
      controller.signal,
    )
      .then((data) => setResult({ key: requestKey, kind: 'ready', data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted || handleApiError(error)) return;
        setResult({
          key: requestKey,
          kind: 'error',
          message: error instanceof ApiError ? error.message : 'The list could not be loaded.',
        });
      });
    return () => controller.abort();
  }, [entity, search, status, provinceId, page, requestKey, handleApiError]);

  // Province filter options for divisions (all provinces, so inactive ones can be filtered too).
  useEffect(() => {
    if (entity !== 'divisions') return;
    const controller = new AbortController();
    listMasterRecords('provinces', { status: 'all', pageSize: 100 }, controller.signal)
      .then((data) => setProvinces(data.items))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) handleApiError(error);
      });
    return () => controller.abort();
  }, [entity, handleApiError, reload]);

  const loading = result === null || result.key !== requestKey;
  const data = !loading && result?.kind === 'ready' ? result.data : null;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(search) || status !== 'active' || Boolean(provinceId);

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setSearch(searchText.trim());
    setPage(1);
  };

  const onSaved = useCallback(
    (record: MasterRecord, created: boolean) => {
      setDialog(null);
      setNotice({
        kind: 'success',
        text: `${created ? 'Created' : 'Saved'} ${record.code} “${record.name}”.`,
      });
      refresh();
    },
    [refresh],
  );

  const toggleActive = async (record: MasterRecord) => {
    setBusyId(record.id);
    setNotice(null);
    try {
      const saved = await updateMasterRecord(
        entity,
        record.id,
        { rev: record.rev, active: !record.active },
        csrfToken,
      );
      setNotice({
        kind: 'success',
        text: `${saved.active ? 'Activated' : 'Deactivated'} ${saved.code} “${saved.name}”.`,
      });
      refresh();
    } catch (error) {
      if (handleApiError(error)) return;
      setNotice({
        kind: 'error',
        text: error instanceof ApiError ? error.message : 'The change could not be saved.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const rangeText = useMemo(() => {
    if (!data || data.total === 0) return '';
    const first = (data.page - 1) * data.pageSize + 1;
    const last = Math.min(data.total, data.page * data.pageSize);
    return `Showing ${first}–${last} of ${data.total}`;
  }, [data]);

  const controlClass =
    'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200';

  return (
    <section aria-labelledby="master-list-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="master-list-heading" className="text-lg font-semibold text-slate-900">
            {meta.label}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">{meta.description}</p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setDialog({ mode: 'create' });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New {meta.singular}
          </button>
        )}
      </div>

      {!canWrite && (
        <div
          className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
          role="note"
        >
          <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Read-only access. Only the Production Operator can change master data.</span>
        </div>
      )}

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={[
            'flex gap-2 rounded-md border px-4 py-3 text-sm',
            notice.kind === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900',
          ].join(' ')}
        >
          {notice.kind === 'error' ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end">
        <form className="flex flex-1 gap-2" role="search" onSubmit={onSearch}>
          <label htmlFor="master-search" className="sr-only">
            Search {meta.label.toLowerCase()}
          </label>
          <input
            id="master-search"
            type="search"
            placeholder={`Search ${meta.label.toLowerCase()} by name`}
            value={searchText}
            maxLength={100}
            onChange={(e) => setSearchText(e.target.value)}
            className={`min-w-0 flex-1 ${controlClass}`}
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col">
            <label htmlFor="master-status" className="text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="master-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as MasterStatusFilter);
                setPage(1);
              }}
              className={`mt-1 ${controlClass}`}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
          {entity === 'divisions' && (
            <div className="flex flex-col">
              <label
                htmlFor="master-province-filter"
                className="text-xs font-medium text-slate-600"
              >
                Province
              </label>
              <select
                id="master-province-filter"
                value={provinceId}
                onChange={(e) => {
                  setProvinceId(e.target.value);
                  setPage(1);
                }}
                className={`mt-1 ${controlClass}`}
              >
                <option value="">All provinces</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.active ? p.name : `${p.name} (inactive)`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div
          className="space-y-2 rounded-lg border border-slate-200 bg-white p-4"
          aria-busy="true"
          aria-label={`Loading ${meta.label.toLowerCase()}`}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && result?.kind === 'error' && (
        <div
          className="flex flex-col items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <p className="flex-1 text-sm text-red-800">{result.message}</p>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {data && data.total === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          {filtered
            ? `No ${meta.label.toLowerCase()} match these filters.`
            : `No ${meta.label.toLowerCase()} have been added yet.`}
          {canWrite && !filtered && ' Use “New ' + meta.singular + '” to add the first one.'}
        </div>
      )}

      {data && data.total > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <caption className="sr-only">{meta.label}</caption>
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Code
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Name
                  </th>
                  {entity === 'divisions' && (
                    <th scope="col" className="px-4 py-3">
                      Province
                    </th>
                  )}
                  <th scope="col" className="px-4 py-3">
                    Status
                  </th>
                  {canWrite && (
                    <th scope="col" className="px-4 py-3 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-500">
                      {record.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{record.name}</td>
                    {entity === 'divisions' && (
                      <td className="px-4 py-3 text-slate-700">{record.provinceName ?? '—'}</td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                          record.active
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                            : 'bg-slate-100 text-slate-600 ring-slate-200',
                        ].join(' ')}
                      >
                        {record.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNotice(null);
                              setDialog({ mode: 'edit', record });
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-emerald-800 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            aria-label={`Edit ${record.name}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(record)}
                            disabled={busyId === record.id}
                            className="rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-60"
                            aria-label={`${record.active ? 'Deactivate' : 'Activate'} ${record.name}`}
                          >
                            {record.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>{rangeText}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
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
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog && canWrite && (
        <MasterRecordDialog
          entity={entity}
          record={dialog.mode === 'edit' ? dialog.record : undefined}
          csrfToken={csrfToken}
          onClose={closeDialog}
          onSaved={onSaved}
          onApiError={handleApiError}
        />
      )}
    </section>
  );
}
