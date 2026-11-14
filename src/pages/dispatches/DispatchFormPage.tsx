import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Info, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  ApiError,
  createDispatch,
  getDemand,
  listAllMasterRecords,
  listAllStockBalances,
  listDemands,
} from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  DocumentsEditor,
  documentsPayload,
  validateDocuments,
  type DocumentRow,
} from '../../components/Documents';
import {
  BackLink,
  detailsToFieldErrors,
  ErrorPanel,
  FieldError,
  inputClass,
  LoadingRows,
  Notice,
  primaryButton,
  secondaryButton,
} from '../../components/ui';
import { todayInKarachi, type DemandDetail, type DemandSummary } from '../../contracts/demands';
import type { MasterRecord } from '../../contracts/masterData';
import type { DispatchPayload, StockBalance, StockLocationKind } from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';
import { TransportFields } from './TransportFields';

interface Options {
  warehouses: MasterRecord[];
  divisions: MasterRecord[];
  demands: DemandSummary[];
}

interface LineRow {
  key: string;
  poLineId: string;
  quantity: string;
  demandLineId: string;
}

let lineSeq = 0;
const newLine = (): LineRow => ({
  key: `dispatch-line-${(lineSeq += 1)}`,
  poLineId: '',
  quantity: '',
  demandLineId: '',
});

export function DispatchFormPage() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const options = useResource<Options>(
    'dispatch-options',
    async (signal) => {
      const [warehouses, divisions, demands] = await Promise.all([
        listAllMasterRecords('warehouses', 'active', signal),
        listAllMasterRecords('divisions', 'active', signal),
        listDemands({ status: 'open', sort: 'demandDate_desc', pageSize: 100 }, signal).then(
          (r) => r.items,
        ),
      ]);
      return { warehouses, divisions, demands };
    },
    'The dispatch form could not be loaded.',
  );

  if (session?.user.role !== 'OPERATOR') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">New dispatch</h1>
        <Notice kind="error">Only the Production Operator can record dispatches.</Notice>
        <BackLink to="/dispatches">All dispatches</BackLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink to="/dispatches">All dispatches</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New dispatch</h1>
        <p className="mt-1 text-sm text-slate-600">
          Send stock lots from a warehouse, or from a division that received a direct delivery, to a
          destination division. Optionally link the dispatch to a demand.
        </p>
      </div>
      {options.loading && <LoadingRows label="Loading form" rows={6} />}
      {options.error && <ErrorPanel message={options.error} onRetry={options.reload} />}
      {options.data && (
        <DispatchForm
          options={options.data}
          initialDemandId={searchParams.get('demandId') ?? ''}
          csrfToken={session.csrfToken}
        />
      )}
    </div>
  );
}

function lotLabel(b: StockBalance): string {
  return `${b.item.name} — PO ${b.lot.poNumber} line ${b.lot.poLineNo} (${b.quantity.toLocaleString()} available)`;
}

/** The single destination division of a demand's open lines, if they all go to one place. */
function suggestedDestination(demand: DemandDetail | null): string {
  if (!demand) return '';
  const ids = new Set(
    demand.lines.filter((l) => l.quantityRemaining > 0).map((l) => l.destinationDivision.id),
  );
  return ids.size === 1 ? ([...ids][0] ?? '') : '';
}

function DispatchForm({
  options,
  initialDemandId,
  csrfToken,
}: {
  options: Options;
  initialDemandId: string;
  csrfToken: string;
}) {
  const { handleApiError } = useAuth();
  const navigate = useNavigate();
  const today = todayInKarachi();

  const [dispatchDate, setDispatchDate] = useState(today);
  const [sourceKind, setSourceKind] = useState<StockLocationKind>('WAREHOUSE');
  const [sourceId, setSourceId] = useState('');
  const [destinationChoice, setDestinationChoice] = useState('');
  const [demandId, setDemandId] = useState(initialDemandId);
  const [biltyNo, setBiltyNo] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [freightAmount, setFreightAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [lines, setLines] = useState<LineRow[]>([newLine()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const lots = useResource(
    sourceId ? `lots:${sourceKind}:${sourceId}` : null,
    (signal) =>
      listAllStockBalances({ locationKind: sourceKind, locationId: sourceId }, signal).then(
        (items) => items.filter((b) => b.quantity > 0),
      ),
    'Stock at this location could not be loaded.',
  );
  const demand = useResource(
    demandId ? `demand:${demandId}` : null,
    (signal) => getDemand(demandId, signal),
    'The demand could not be loaded.',
  );
  const demandData = demand.data;

  // Goods held at a division (direct delivery) can only be dispatched to that same division.
  const destinationLocked = sourceKind === 'DIVISION';
  const destinationId = destinationLocked
    ? sourceId
    : destinationChoice || suggestedDestination(demandData);

  const lotsById = useMemo(
    () => new Map((lots.data ?? []).map((b) => [b.lot.poLineId, b])),
    [lots.data],
  );
  const demandLines = demandData?.lines ?? [];
  const demandOptions = options.demands.filter(
    (d) => d.fulfilment !== 'DELIVERED' || d.id === demandId,
  );
  const sources = sourceKind === 'WAREHOUSE' ? options.warehouses : options.divisions;

  const candidateDemandLines = (row: LineRow) => {
    const lot = lotsById.get(row.poLineId);
    return demandLines.filter(
      (dl) =>
        dl.id === row.demandLineId ||
        (lot !== undefined &&
          dl.item.id === lot.item.id &&
          dl.destinationDivision.id === destinationId &&
          dl.quantityRemaining > 0),
    );
  };

  const updateLine = (key: string, patch: Partial<LineRow>) =>
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const changeSource = (kind: StockLocationKind, id: string) => {
    setSourceKind(kind);
    setSourceId(id);
    // Lots belong to the source location, so earlier line choices no longer apply.
    setLines([newLine()]);
  };

  const clearDemandLinks = () => setLines((rows) => rows.map((r) => ({ ...r, demandLineId: '' })));

  const focusError = (message: string) => {
    setSubmitError(message);
    errorRef.current?.focus();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!dispatchDate) next.dispatchDate = 'Dispatch date is required';
    else if (dispatchDate > today) next.dispatchDate = 'Dispatch date cannot be in the future';
    if (!sourceId) next.sourceId = 'Choose where the goods are dispatched from';
    if (!destinationId) next.destinationDivisionId = 'Choose the destination division';
    else if (destinationLocked && destinationId !== sourceId)
      next.destinationDivisionId = 'Goods held at a division can only go to that division';

    const perLot = new Map<string, number>();
    const perDemandLine = new Map<string, number>();
    const seen = new Set<string>();
    lines.forEach((row, index) => {
      const path = `lines.${index}`;
      const lot = lotsById.get(row.poLineId);
      if (!row.poLineId || !lot) next[`${path}.poLineId`] = 'Choose a stock lot';
      const qty = Number(row.quantity);
      if (!row.quantity.trim() || !Number.isInteger(qty) || qty < 1) {
        next[`${path}.quantity`] = 'Enter a whole number of at least 1';
      } else if (lot) {
        perLot.set(lot.lot.poLineId, (perLot.get(lot.lot.poLineId) ?? 0) + qty);
        if ((perLot.get(lot.lot.poLineId) ?? 0) > lot.quantity)
          next[`${path}.quantity`] =
            `Only ${lot.quantity.toLocaleString()} available at this location`;
      }
      const pair = `${row.poLineId}:${row.demandLineId}`;
      if (row.poLineId && seen.has(pair))
        next[`${path}.poLineId`] = 'This lot is already listed. Combine the quantities instead.';
      seen.add(pair);
      if (row.demandLineId) {
        const dl = demandLines.find((d) => d.id === row.demandLineId);
        if (!dl) {
          next[`${path}.demandLineId`] = 'Choose a line of the selected demand';
        } else if (lot && dl.item.id !== lot.item.id) {
          next[`${path}.demandLineId`] = 'The demand line is for a different item';
        } else if (dl.destinationDivision.id !== destinationId) {
          next[`${path}.demandLineId`] = 'The demand line is for a different destination division';
        } else if (Number.isInteger(qty) && qty >= 1) {
          perDemandLine.set(dl.id, (perDemandLine.get(dl.id) ?? 0) + qty);
          if ((perDemandLine.get(dl.id) ?? 0) > dl.quantityRemaining)
            next[`${path}.quantity`] =
              `The demand line has only ${dl.quantityRemaining.toLocaleString()} remaining`;
        }
      }
    });
    if (lines.length === 0) next.lines = 'Dispatch at least one line';

    let freight: number | null = null;
    if (freightAmount.trim()) {
      freight = Number(freightAmount);
      if (!Number.isFinite(freight) || freight < 0)
        next.freightAmount = 'Freight must be 0 or more';
    }
    validateDocuments(documents, next);

    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusError('Please fix the errors below.');
      return;
    }

    const payload: DispatchPayload = {
      dispatchDate,
      sourceKind,
      sourceId,
      destinationDivisionId: destinationId,
      demandId: demandId || null,
      biltyNo: biltyNo.trim() || null,
      transporterName: transporterName.trim() || null,
      vehicleNo: vehicleNo.trim() || null,
      freightAmount: freight,
      notes: notes.trim() || null,
      documents: documentsPayload(documents),
      lines: lines.map((row) => ({
        poLineId: row.poLineId,
        quantity: Number(row.quantity),
        demandLineId: row.demandLineId || null,
      })),
    };

    setSaving(true);
    setSubmitError(null);
    try {
      const created = await createDispatch(payload, csrfToken);
      navigate(`/dispatches/${created.id}`, {
        state: { notice: `Dispatch ${created.code} recorded.` },
      });
    } catch (err) {
      if (handleApiError(err)) return;
      if (err instanceof ApiError && err.details.length > 0) {
        setErrors(detailsToFieldErrors(err));
        focusError(
          err.message || 'The server rejected some entries. Check the highlighted fields.',
        );
      } else {
        focusError(err instanceof ApiError ? err.message : 'The dispatch could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  const describe = (key: string, id: string) => (errors[key] ? id : undefined);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div ref={errorRef} tabIndex={-1} className="outline-none">
        {submitError && <Notice kind="error">{submitError}</Notice>}
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-900">
          Route
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="dispatch-date" className="block text-sm font-medium text-slate-700">
              Dispatch date
            </label>
            <input
              id="dispatch-date"
              type="date"
              value={dispatchDate}
              max={today}
              onChange={(e) => setDispatchDate(e.target.value)}
              aria-invalid={Boolean(errors.dispatchDate)}
              aria-describedby={describe('dispatchDate', 'dispatch-date-error')}
              className={`${inputClass(Boolean(errors.dispatchDate))} mt-1`}
            />
            <FieldError id="dispatch-date-error" message={errors.dispatchDate} />
          </div>
          <div>
            <label htmlFor="source-kind" className="block text-sm font-medium text-slate-700">
              Dispatch from
            </label>
            <select
              id="source-kind"
              value={sourceKind}
              onChange={(e) => changeSource(e.target.value as StockLocationKind, '')}
              className={`${inputClass()} mt-1`}
            >
              <option value="WAREHOUSE">Warehouse</option>
              <option value="DIVISION">Division (direct-delivery stock)</option>
            </select>
          </div>
          <div>
            <label htmlFor="source-id" className="block text-sm font-medium text-slate-700">
              {sourceKind === 'WAREHOUSE' ? 'Source warehouse' : 'Source division'}
            </label>
            <select
              id="source-id"
              value={sourceId}
              onChange={(e) => changeSource(sourceKind, e.target.value)}
              aria-invalid={Boolean(errors.sourceId)}
              aria-describedby={describe('sourceId', 'source-id-error')}
              className={`${inputClass(Boolean(errors.sourceId))} mt-1`}
            >
              <option value="">Select…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.provinceName ? `, ${s.provinceName}` : ''}
                </option>
              ))}
            </select>
            <FieldError id="source-id-error" message={errors.sourceId} />
          </div>
          <div>
            <label htmlFor="destination-id" className="block text-sm font-medium text-slate-700">
              Destination division
            </label>
            <select
              id="destination-id"
              value={destinationId}
              disabled={destinationLocked}
              onChange={(e) => {
                setDestinationChoice(e.target.value);
                clearDemandLinks();
              }}
              aria-invalid={Boolean(errors.destinationDivisionId)}
              aria-describedby={describe('destinationDivisionId', 'destination-id-error')}
              className={`${inputClass(Boolean(errors.destinationDivisionId))} mt-1`}
            >
              <option value="">Select…</option>
              {options.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.provinceName ? `, ${d.provinceName}` : ''}
                </option>
              ))}
            </select>
            <FieldError id="destination-id-error" message={errors.destinationDivisionId} />
          </div>
        </div>
        {destinationLocked && (
          <p className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Goods delivered directly to a division are dispatched within that division, so the
            destination is the source division.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="demand-id" className="block text-sm font-medium text-slate-700">
              Demand (optional)
            </label>
            <select
              id="demand-id"
              value={demandId}
              onChange={(e) => {
                setDemandId(e.target.value);
                clearDemandLinks();
              }}
              aria-invalid={Boolean(errors.demandId)}
              aria-describedby={describe('demandId', 'demand-id-error')}
              className={`${inputClass(Boolean(errors.demandId))} mt-1`}
            >
              <option value="">Not linked to a demand</option>
              {demandId && !demandOptions.some((d) => d.id === demandId) && (
                <option value={demandId}>{demandData?.code ?? 'Selected demand'}</option>
              )}
              {demandOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code} · {d.department.name} · {d.province.name}
                </option>
              ))}
            </select>
            <FieldError id="demand-id-error" message={errors.demandId} />
            {demand.error && <p className="mt-1 text-xs text-red-700">{demand.error}</p>}
          </div>
        </div>

        {demandData && (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <caption className="bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Open lines of {demandData.code}
              </caption>
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    #
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Item
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Destination
                  </th>
                  <th scope="col" className="px-3 py-2 text-right">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {demandData.lines.map((dl) => (
                  <tr
                    key={dl.id}
                    className={dl.destinationDivision.id === destinationId ? '' : 'text-slate-400'}
                  >
                    <td className="px-3 py-2 tabular-nums">{dl.lineNo}</td>
                    <td className="px-3 py-2">{dl.item.name}</td>
                    <td className="px-3 py-2">
                      {dl.destinationDivision.name}
                      {dl.destinationDivision.provinceName &&
                        `, ${dl.destinationDivision.provinceName}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {dl.quantityRemaining.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-slate-500">
              Only lines for the chosen destination division can be linked to this dispatch.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-900">
          Items dispatched
        </h2>
        {!sourceId && (
          <p className="text-sm text-slate-500">Choose the source location to see its stock.</p>
        )}
        {lots.loading && <LoadingRows label="Loading stock at source" rows={2} />}
        {lots.error && <ErrorPanel message={lots.error} onRetry={lots.reload} />}
        {lots.data && lots.data.length === 0 && (
          <Notice kind="error">There is no stock at this location to dispatch.</Notice>
        )}
        {errors.lines && <Notice kind="error">{errors.lines}</Notice>}
        {sourceId &&
          lots.data &&
          lots.data.length > 0 &&
          lines.map((row, index) => {
            const n = index + 1;
            const path = `lines.${index}`;
            const lot = lotsById.get(row.poLineId);
            const dlOptions = candidateDemandLines(row);
            return (
              <div
                key={row.key}
                className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-start"
              >
                <div>
                  <label
                    htmlFor={`${row.key}-lot`}
                    className="block text-xs font-medium text-slate-700"
                  >
                    Line {n} stock lot
                  </label>
                  <select
                    id={`${row.key}-lot`}
                    value={row.poLineId}
                    onChange={(e) =>
                      updateLine(row.key, { poLineId: e.target.value, demandLineId: '' })
                    }
                    aria-invalid={Boolean(errors[`${path}.poLineId`])}
                    aria-describedby={describe(`${path}.poLineId`, `${row.key}-lot-error`)}
                    className={`${inputClass(Boolean(errors[`${path}.poLineId`]))} mt-1`}
                  >
                    <option value="">Select…</option>
                    {(lots.data ?? []).map((b) => (
                      <option key={b.lot.poLineId} value={b.lot.poLineId}>
                        {lotLabel(b)}
                      </option>
                    ))}
                  </select>
                  <FieldError id={`${row.key}-lot-error`} message={errors[`${path}.poLineId`]} />
                </div>
                <div>
                  <label
                    htmlFor={`${row.key}-qty`}
                    className="block text-xs font-medium text-slate-700"
                  >
                    Line {n} quantity
                  </label>
                  <input
                    id={`${row.key}-qty`}
                    type="number"
                    min={1}
                    max={lot?.quantity}
                    step={1}
                    inputMode="numeric"
                    value={row.quantity}
                    onChange={(e) => updateLine(row.key, { quantity: e.target.value })}
                    aria-invalid={Boolean(errors[`${path}.quantity`])}
                    aria-describedby={describe(`${path}.quantity`, `${row.key}-qty-error`)}
                    className={`${inputClass(Boolean(errors[`${path}.quantity`]))} mt-1`}
                  />
                  {lot && (
                    <p className="mt-1 text-xs text-slate-500">
                      Available: {lot.quantity.toLocaleString()}
                    </p>
                  )}
                  <FieldError id={`${row.key}-qty-error`} message={errors[`${path}.quantity`]} />
                </div>
                <div>
                  <label
                    htmlFor={`${row.key}-demand-line`}
                    className="block text-xs font-medium text-slate-700"
                  >
                    Line {n} demand line
                  </label>
                  <select
                    id={`${row.key}-demand-line`}
                    value={row.demandLineId}
                    disabled={!demandData}
                    onChange={(e) => updateLine(row.key, { demandLineId: e.target.value })}
                    aria-invalid={Boolean(errors[`${path}.demandLineId`])}
                    aria-describedby={describe(
                      `${path}.demandLineId`,
                      `${row.key}-demand-line-error`,
                    )}
                    className={`${inputClass(Boolean(errors[`${path}.demandLineId`]))} mt-1`}
                  >
                    <option value="">
                      {demandData ? 'Not linked' : 'Select a demand to link lines'}
                    </option>
                    {dlOptions.map((dl) => (
                      <option key={dl.id} value={dl.id}>
                        Line {dl.lineNo}: {dl.item.name} → {dl.destinationDivision.name} (
                        {dl.quantityRemaining.toLocaleString()} remaining)
                      </option>
                    ))}
                  </select>
                  {demandData && lot && dlOptions.length === 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      No open demand line for this item and destination.
                    </p>
                  )}
                  <FieldError
                    id={`${row.key}-demand-line-error`}
                    message={errors[`${path}.demandLineId`]}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLines((rows) => rows.filter((r) => r.key !== row.key))}
                  disabled={lines.length === 1}
                  className="mt-5 rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-40"
                  aria-label={`Remove line ${n}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        {sourceId && lots.data && lots.data.length > 0 && (
          <button
            type="button"
            onClick={() => setLines((rows) => [...rows, newLine()])}
            className={secondaryButton}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add line
          </button>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-900">
          Bilty and transport
        </h2>
        <p className="text-xs text-slate-500">
          These details can also be completed later from the dispatch page.
        </p>
        <TransportFields
          values={{ biltyNo, transporterName, vehicleNo, freightAmount, notes }}
          setters={{ setBiltyNo, setTransporterName, setVehicleNo, setFreightAmount, setNotes }}
          errors={errors}
        />
        <DocumentsEditor rows={documents} onChange={setDocuments} errors={errors} />
      </section>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="button" onClick={() => navigate('/dispatches')} className={secondaryButton}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Record dispatch'}
        </button>
      </div>
    </form>
  );
}
