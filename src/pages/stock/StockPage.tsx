import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listAllMasterRecords, listStockBalances, listStockMovements } from '../../api';
import { datesInvalid } from '../../components/RecordFilters';
import {
  EmptyState,
  ErrorPanel,
  formatDateOnly,
  formatDateTime,
  inputClass,
  linkClass,
  LoadingRows,
  Pagination,
  StatusBadge,
} from '../../components/ui';
import type { MasterRecord } from '../../contracts/masterData';
import {
  LOCATION_KIND_LABELS,
  MOVEMENT_TYPE_LABELS,
  stockMovementTypes,
  type PoLotRef,
  type StockLocation,
  type StockLocationKind,
  type StockMovementType,
} from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';

const PAGE_SIZE = 25;
type Tab = 'balances' | 'ledger';

interface LocationFilter {
  kind: StockLocationKind | '';
  locationId: string;
  itemId: string;
}

interface Masters {
  warehouses: MasterRecord[];
  divisions: MasterRecord[];
  items: MasterRecord[];
}

export function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'ledger' ? 'ledger' : 'balances';
  const masters = useResource<Masters>(
    'stock-masters',
    async (signal) => {
      const [warehouses, divisions, items] = await Promise.all([
        listAllMasterRecords('warehouses', 'all', signal),
        listAllMasterRecords('divisions', 'all', signal),
        listAllMasterRecords('items', 'all', signal),
      ]);
      return { warehouses, divisions, items };
    },
    'Filter lists could not be loaded.',
  );
  const lists = masters.data ?? { warehouses: [], divisions: [], items: [] };

  const selectTab = (next: Tab) => setSearchParams(next === 'ledger' ? { tab: 'ledger' } : {});
  const onTabKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const next = tab === 'balances' ? 'ledger' : 'balances';
      selectTab(next);
      document.getElementById(`tab-${next}`)?.focus();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock &amp; ledger</h1>
        <p className="mt-1 text-sm text-slate-600">
          Stock is held by purchase-order lot. Warehouse stock comes from warehouse-route receipts;
          division stock comes from direct deliveries and is dispatched from the division itself.
        </p>
      </div>

      <div role="tablist" aria-label="Stock views" className="flex gap-1 border-b border-slate-200">
        {(['balances', 'ledger'] as const).map((t) => (
          <button
            key={t}
            id={`tab-${t}`}
            type="button"
            role="tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => selectTab(t)}
            onKeyDown={onTabKey}
            className={[
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
              tab === t
                ? 'border-emerald-700 text-emerald-800'
                : 'border-transparent text-slate-600 hover:text-slate-900',
            ].join(' ')}
          >
            {t === 'balances' ? 'Balances' : 'Ledger'}
          </button>
        ))}
      </div>

      {masters.error && <ErrorPanel message={masters.error} onRetry={masters.reload} />}

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'balances' ? <BalancesTab lists={lists} /> : <LedgerTab lists={lists} />}
      </div>
    </div>
  );
}

function LocationFilters({
  value,
  onChange,
  lists,
  children,
}: {
  value: LocationFilter;
  onChange(value: LocationFilter): void;
  lists: Masters;
  children?: ReactNode;
}) {
  const locations =
    value.kind === 'WAREHOUSE'
      ? lists.warehouses
      : value.kind === 'DIVISION'
        ? lists.divisions
        : [];
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
      <label className="block text-xs font-medium text-slate-600">
        Location type
        <select
          value={value.kind}
          onChange={(e) =>
            onChange({ ...value, kind: e.target.value as StockLocationKind | '', locationId: '' })
          }
          className={`${inputClass()} mt-1`}
        >
          <option value="">Warehouses and divisions</option>
          <option value="WAREHOUSE">Warehouses</option>
          <option value="DIVISION">Divisions (direct delivery)</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Location
        <select
          value={value.locationId}
          disabled={!value.kind}
          onChange={(e) => onChange({ ...value, locationId: e.target.value })}
          className={`${inputClass()} mt-1`}
        >
          <option value="">{value.kind ? 'All locations' : 'Choose a location type first'}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {!l.active ? ' (inactive)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Item
        <select
          value={value.itemId}
          onChange={(e) => onChange({ ...value, itemId: e.target.value })}
          className={`${inputClass()} mt-1`}
        >
          <option value="">All items</option>
          {lists.items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
              {!i.active ? ' (inactive)' : ''}
            </option>
          ))}
        </select>
      </label>
      {children}
    </div>
  );
}

function LocationCell({ location }: { location: StockLocation }) {
  return (
    <>
      <div className="font-medium text-slate-900">{location.name}</div>
      <StatusBadge tone={location.kind === 'WAREHOUSE' ? 'green' : 'amber'}>
        {LOCATION_KIND_LABELS[location.kind]}
      </StatusBadge>
    </>
  );
}

function LotCell({ lot }: { lot: PoLotRef }) {
  return (
    <>
      <Link to={`/purchase-orders/${lot.purchaseOrderId}`} className={linkClass}>
        {lot.poNumber}
      </Link>
      <div className="text-xs text-slate-500">
        {lot.purchaseOrderCode} · line {lot.poLineNo}
      </div>
    </>
  );
}

function BalancesTab({ lists }: { lists: Masters }) {
  const [filter, setFilter] = useState<LocationFilter>({ kind: '', locationId: '', itemId: '' });
  const [includeZero, setIncludeZero] = useState(false);
  const [page, setPage] = useState(1);
  const params = {
    locationKind: filter.kind || undefined,
    locationId: filter.locationId || undefined,
    itemId: filter.itemId || undefined,
    includeZero: includeZero ? ('true' as const) : undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const balances = useResource(
    JSON.stringify(params),
    (signal) => listStockBalances(params, signal),
    'Stock balances could not be loaded.',
  );

  return (
    <div className="space-y-4 pt-4">
      <LocationFilters
        value={filter}
        lists={lists}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
      >
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeZero}
            onChange={(e) => {
              setIncludeZero(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-slate-300 text-emerald-700"
          />
          Show empty lots
        </label>
      </LocationFilters>

      {balances.loading ? (
        <LoadingRows label="Loading stock balances" rows={6} />
      ) : balances.error ? (
        <ErrorPanel message={balances.error} onRetry={balances.reload} />
      ) : balances.data && balances.data.items.length === 0 ? (
        <EmptyState title="No stock matches these filters">
          Stock appears here once goods are received against a purchase order.
        </EmptyState>
      ) : balances.data ? (
        <>
          <p className="text-sm text-slate-700" aria-live="polite">
            Total units for these filters:{' '}
            <strong className="tabular-nums text-slate-900">
              {balances.data.totalQuantity.toLocaleString()}
            </strong>{' '}
            across {balances.data.total} {balances.data.total === 1 ? 'lot' : 'lots'}
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <caption className="sr-only">Stock balances</caption>
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Location
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Item
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Lot (PO / line)
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    On hand
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {balances.data.items.map((b) => (
                  <tr key={`${b.location.kind}:${b.location.id}:${b.lot.poLineId}`}>
                    <td className="px-4 py-3">
                      <LocationCell location={b.location} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{b.item.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <LotCell lot={b.lot} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {b.quantity.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={balances.data.total}
            noun="lots"
            onPage={setPage}
          />
        </>
      ) : null}
    </div>
  );
}

function LedgerTab({ lists }: { lists: Masters }) {
  const [filter, setFilter] = useState<LocationFilter>({ kind: '', locationId: '', itemId: '' });
  const [type, setType] = useState<StockMovementType | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const invalid = datesInvalid({ from, to });
  const params = {
    locationKind: filter.kind || undefined,
    locationId: filter.locationId || undefined,
    itemId: filter.itemId || undefined,
    type: type || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const movements = useResource(
    invalid ? null : JSON.stringify(params),
    (signal) => listStockMovements(params, signal),
    'The inventory ledger could not be loaded.',
  );

  return (
    <div className="space-y-4 pt-4">
      <LocationFilters
        value={filter}
        lists={lists}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
      >
        <label className="block text-xs font-medium text-slate-600">
          Movement type
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as StockMovementType | '');
              setPage(1);
            }}
            className={`${inputClass()} mt-1`}
          >
            <option value="">All movements</option>
            {stockMovementTypes.map((t) => (
              <option key={t} value={t}>
                {MOVEMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          From date
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className={`${inputClass(invalid)} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          To date
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className={`${inputClass(invalid)} mt-1`}
          />
        </label>
      </LocationFilters>
      {invalid && (
        <p className="text-xs text-red-700" role="alert">
          &quot;From&quot; date must not be after &quot;To&quot; date.
        </p>
      )}

      {movements.loading ? (
        <LoadingRows label="Loading inventory ledger" rows={6} />
      ) : movements.error ? (
        <ErrorPanel message={movements.error} onRetry={movements.reload} />
      ) : movements.data && movements.data.items.length === 0 ? (
        <EmptyState title="No stock movements match these filters" />
      ) : movements.data ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <caption className="sr-only">Inventory ledger</caption>
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Movement
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Location
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Item
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Lot (PO / line)
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Quantity
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Recorded
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {movements.data.items.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {formatDateOnly(m.movementDate)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-slate-900">
                        {MOVEMENT_TYPE_LABELS[m.type]}
                      </div>
                      <Link
                        to={
                          m.source.kind === 'RECEIPT'
                            ? `/receiving/${m.source.id}`
                            : `/dispatches/${m.source.id}`
                        }
                        className={`${linkClass} text-xs`}
                      >
                        {m.source.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <LocationCell location={m.location} />
                    </td>
                    <td className="px-4 py-3 text-slate-900">{m.item.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <LotCell lot={m.lot} />
                    </td>
                    <td
                      className={[
                        'px-4 py-3 text-right font-semibold tabular-nums whitespace-nowrap',
                        m.quantity >= 0 ? 'text-emerald-700' : 'text-red-700',
                      ].join(' ')}
                    >
                      {m.quantity > 0 ? '+' : m.quantity < 0 ? '−' : ''}
                      {Math.abs(m.quantity).toLocaleString()}
                      <span className="sr-only">{m.quantity >= 0 ? ' in' : ' out'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDateTime(m.recordedAt)}
                      {m.by && <div>{m.by}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={movements.data.total}
            noun="movements"
            onPage={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
