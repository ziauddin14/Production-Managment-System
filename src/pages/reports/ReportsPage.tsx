import { useState, type FormEvent } from 'react';
import { Download, Loader2, Play, Printer } from 'lucide-react';
import { ApiError, downloadReportCsv, getReport, listAllMasterRecords } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { datesInvalid } from '../../components/RecordFilters';
import {
  EmptyState,
  ErrorPanel,
  formatDateTime,
  formatMoney,
  inputClass,
  LoadingRows,
  Notice,
  primaryButton,
  secondaryButton,
} from '../../components/ui';
import { todayInKarachi } from '../../contracts/demands';
import type { MasterRecord } from '../../contracts/masterData';
import {
  REPORT_LABELS,
  reportKeys,
  type ReportColumn,
  type ReportKey,
  type ReportParams,
  type ReportResponse,
} from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';

interface FilterState {
  from: string;
  to: string;
  vendorId: string;
  itemId: string;
  provinceId: string;
  divisionId: string;
  warehouseId: string;
  includeCancelled: boolean;
}

const EMPTY_FILTERS: FilterState = {
  from: '',
  to: '',
  vendorId: '',
  itemId: '',
  provinceId: '',
  divisionId: '',
  warehouseId: '',
  includeCancelled: false,
};

interface Masters {
  vendors: MasterRecord[];
  items: MasterRecord[];
  provinces: MasterRecord[];
  divisions: MasterRecord[];
  warehouses: MasterRecord[];
}

function toParams(f: FilterState): ReportParams {
  return {
    from: f.from || undefined,
    to: f.to || undefined,
    vendorId: f.vendorId || undefined,
    itemId: f.itemId || undefined,
    provinceId: f.provinceId || undefined,
    divisionId: f.divisionId || undefined,
    warehouseId: f.warehouseId || undefined,
    includeCancelled: f.includeCancelled ? 'true' : undefined,
  };
}

const numberFormat = new Intl.NumberFormat();

function formatCell(column: ReportColumn, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (column.type === 'money' && typeof value === 'number') return formatMoney(value);
  if (column.type === 'number' && typeof value === 'number') return numberFormat.format(value);
  return String(value);
}

/** Saves a downloaded file in the browser with the given name. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const { handleApiError } = useAuth();
  const [reportKey, setReportKey] = useState<ReportKey>('purchase-orders');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<{ key: ReportKey; params: ReportParams } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const invalid = datesInvalid(filters);

  const masters = useResource<Masters>(
    'report-masters',
    async (signal) => {
      const [vendors, items, provinces, divisions, warehouses] = await Promise.all([
        listAllMasterRecords('vendors', 'all', signal),
        listAllMasterRecords('items', 'all', signal),
        listAllMasterRecords('provinces', 'all', signal),
        listAllMasterRecords('divisions', 'all', signal),
        listAllMasterRecords('warehouses', 'all', signal),
      ]);
      return { vendors, items, provinces, divisions, warehouses };
    },
    'Filter lists could not be loaded.',
  );
  const lists = masters.data ?? {
    vendors: [],
    items: [],
    provinces: [],
    divisions: [],
    warehouses: [],
  };
  const divisions = filters.provinceId
    ? lists.divisions.filter((d) => d.provinceId === filters.provinceId)
    : lists.divisions;

  const report = useResource(
    applied ? JSON.stringify(applied) : null,
    (signal) =>
      applied ? getReport(applied.key, applied.params, signal) : Promise.reject(new Error()),
    'The report could not be loaded.',
  );

  const set = (patch: Partial<FilterState>) => setFilters((f) => ({ ...f, ...patch }));

  const run = (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    const next = { key: reportKey, params: toParams(filters) };
    if (applied && JSON.stringify(applied) === JSON.stringify(next)) report.reload();
    else setApplied(next);
  };

  const downloadCsv = async () => {
    if (invalid) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadReportCsv(reportKey, toParams(filters));
      saveBlob(blob, `${reportKey}-${todayInKarachi()}.csv`);
    } catch (err) {
      if (handleApiError(err)) return;
      setDownloadError(err instanceof ApiError ? err.message : 'The CSV could not be downloaded.');
    } finally {
      setDownloading(false);
    }
  };

  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: MasterRecord[],
    allLabel: string,
  ) => (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass()} mt-1`}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
            {!o.active ? ' (inactive)' : ''}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          Choose a report and filters, then view it here, print it or download it as CSV for Excel.
        </p>
      </div>

      <form
        onSubmit={run}
        noValidate
        aria-label="Report filters"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs print:hidden"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-medium text-slate-600">
            Report
            <select
              value={reportKey}
              onChange={(e) => setReportKey(e.target.value as ReportKey)}
              className={`${inputClass()} mt-1`}
            >
              {reportKeys.map((k) => (
                <option key={k} value={k}>
                  {REPORT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            From date
            <input
              type="date"
              value={filters.from}
              onChange={(e) => set({ from: e.target.value })}
              className={`${inputClass(invalid)} mt-1`}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            To date
            <input
              type="date"
              value={filters.to}
              onChange={(e) => set({ to: e.target.value })}
              className={`${inputClass(invalid)} mt-1`}
            />
          </label>
          {select(
            'Vendor',
            filters.vendorId,
            (v) => set({ vendorId: v }),
            lists.vendors,
            'All vendors',
          )}
          {select('Item', filters.itemId, (v) => set({ itemId: v }), lists.items, 'All items')}
          {select(
            'Province',
            filters.provinceId,
            (v) => set({ provinceId: v, divisionId: '' }),
            lists.provinces,
            'All provinces',
          )}
          {select(
            'Division',
            filters.divisionId,
            (v) => set({ divisionId: v }),
            divisions,
            'All divisions',
          )}
          {select(
            'Warehouse',
            filters.warehouseId,
            (v) => set({ warehouseId: v }),
            lists.warehouses,
            'All warehouses',
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.includeCancelled}
            onChange={(e) => set({ includeCancelled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-emerald-700"
          />
          Include cancelled records
        </label>
        <p className="text-xs text-slate-500">
          Filters that do not apply to the chosen report are ignored by the server.
        </p>
        {invalid && (
          <p className="text-xs text-red-700" role="alert">
            &quot;From&quot; date must not be after &quot;To&quot; date.
          </p>
        )}
        {masters.error && <p className="text-xs text-red-700">{masters.error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primaryButton} disabled={invalid}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Show report
          </button>
          <button
            type="button"
            onClick={() => void downloadCsv()}
            disabled={invalid || downloading}
            className={secondaryButton}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            Download CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!report.data}
            className={secondaryButton}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print
          </button>
        </div>
        {downloadError && <Notice kind="error">{downloadError}</Notice>}
      </form>

      {!applied && (
        <EmptyState title="No report shown yet">
          Choose a report and press &quot;Show report&quot;.
        </EmptyState>
      )}
      {report.loading && <LoadingRows label="Loading report" rows={6} />}
      {report.error && <ErrorPanel message={report.error} onRetry={report.reload} />}
      {report.data && <ReportTable report={report.data} />}
    </div>
  );
}

function ReportTable({ report }: { report: ReportResponse }) {
  const hasTotals = Object.keys(report.totals).length > 0;
  const align = (c: ReportColumn) => (c.type === 'text' ? 'text-left' : 'text-right');
  return (
    <section aria-labelledby="report-title" className="space-y-3">
      <div>
        <h2 id="report-title" className="text-lg font-semibold text-slate-900">
          {report.title}
        </h2>
        <p className="text-xs text-slate-500">
          Generated {formatDateTime(report.generatedAt)} · {report.rows.length.toLocaleString()}{' '}
          {report.rows.length === 1 ? 'row' : 'rows'}
        </p>
      </div>
      {report.truncated && (
        <Notice kind="error">
          The report was cut off at the row limit. Narrow the filters (e.g. a shorter date range) to
          see every row, or download the CSV.
        </Notice>
      )}
      {report.rows.length === 0 ? (
        <EmptyState title="No rows match these filters" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs print:overflow-visible print:border-0 print:shadow-none">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <caption className="sr-only">{report.title}</caption>
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                {report.columns.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    className={`px-3 py-2.5 whitespace-nowrap ${align(c)}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rows.map((row, index) => (
                <tr key={index}>
                  {report.columns.map((c) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2 ${align(c)} ${c.type === 'text' ? '' : 'whitespace-nowrap tabular-nums'}`}
                    >
                      {formatCell(c, row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {hasTotals && (
              <tfoot className="bg-slate-50 font-semibold text-slate-900">
                <tr>
                  {report.columns.map((c, index) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2.5 whitespace-nowrap tabular-nums ${align(c)}`}
                    >
                      {c.key in report.totals
                        ? formatCell(c, report.totals[c.key])
                        : index === 0
                          ? 'Total'
                          : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
