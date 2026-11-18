import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { ApiError, createOpeningStock, listAllMasterRecords } from '../../api';
import { useAuth } from '../../auth/AuthContext';
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
import type { MasterRecord } from '../../contracts/masterData';
import type { OpeningStockPayload } from '../../contracts/operations';
import { todayInKarachi } from '../../contracts/purchaseOrders';
import { useResource } from '../../hooks/useResource';

interface LineDraft {
  key: number;
  itemId: string;
  quantity: string;
}

/**
 * Adds goods that are already in a warehouse (from before PMS, or without a PMS purchase order)
 * to warehouse stock. Each line becomes its own stock lot that can be dispatched.
 */
export function OpeningStockFormPage() {
  const { session } = useAuth();
  const masters = useResource(
    'opening-stock-masters',
    async (signal) => {
      const [warehouses, items] = await Promise.all([
        listAllMasterRecords('warehouses', 'active', signal),
        listAllMasterRecords('items', 'active', signal),
      ]);
      return { warehouses, items };
    },
    'Warehouses and items could not be loaded.',
  );

  if (session?.user.role !== 'OPERATOR') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Add opening stock</h1>
        <Notice kind="error">Only the Production Operator can add stock.</Notice>
        <BackLink to="/stock?tab=opening">Opening stock</BackLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink to="/stock?tab=opening">Opening stock</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add opening stock</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter goods that are already in a warehouse but were not received through a PMS purchase
          order. They are added to warehouse stock and can then be dispatched.
        </p>
      </div>
      {masters.loading && <LoadingRows label="Loading warehouses and items" rows={4} />}
      {masters.error && <ErrorPanel message={masters.error} onRetry={masters.reload} />}
      {masters.data && session && (
        <OpeningStockForm
          warehouses={masters.data.warehouses}
          items={masters.data.items}
          csrfToken={session.csrfToken}
        />
      )}
    </div>
  );
}

function OpeningStockForm({
  warehouses,
  items,
  csrfToken,
}: {
  warehouses: MasterRecord[];
  items: MasterRecord[];
  csrfToken: string;
}) {
  const { handleApiError } = useAuth();
  const navigate = useNavigate();
  const today = todayInKarachi();
  const nextKey = useRef(1);
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0]!.id : '');
  const [entryDate, setEntryDate] = useState(today);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ key: 0, itemId: '', quantity: '' }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const showError = (message: string) => {
    setSubmitError(message);
    errorRef.current?.focus();
  };
  const updateLine = (key: number, change: Partial<LineDraft>) =>
    setLines((all) => all.map((l) => (l.key === key ? { ...l, ...change } : l)));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!warehouseId) next.warehouseId = 'Choose a warehouse';
    if (!entryDate) next.entryDate = 'Date is required';
    else if (entryDate > today) next.entryDate = 'Date cannot be in the future';
    const payloadLines: OpeningStockPayload['lines'] = [];
    const seen = new Set<string>();
    lines.forEach((line, index) => {
      if (!line.itemId) next[`lines.${index}.itemId`] = 'Choose an item for this line';
      else if (seen.has(line.itemId))
        next[`lines.${index}.itemId`] = 'This item is listed twice; combine the quantities';
      seen.add(line.itemId);
      const qty = Number(line.quantity.trim());
      if (!line.quantity.trim() || !Number.isInteger(qty) || qty < 1)
        next[`lines.${index}.quantity`] = 'Enter a whole number of at least 1';
      payloadLines.push({ itemId: line.itemId, quantity: qty });
    });
    setErrors(next);
    if (Object.keys(next).length > 0) {
      showError('Please fix the errors below.');
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const created = await createOpeningStock(
        {
          warehouseId,
          entryDate,
          reference: reference.trim() || null,
          notes: notes.trim() || null,
          lines: payloadLines,
        },
        csrfToken,
      );
      navigate(`/stock/opening/${created.id}`, {
        state: { notice: `Opening stock ${created.code} added to the warehouse.` },
      });
    } catch (err) {
      if (handleApiError(err)) return;
      if (err instanceof ApiError && err.details.length > 0) {
        setErrors(detailsToFieldErrors(err));
        showError(err.message || 'The server rejected some entries. Check the highlighted fields.');
      } else {
        showError(err instanceof ApiError ? err.message : 'The stock could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div ref={errorRef} tabIndex={-1} className="outline-none">
        {submitError && <Notice kind="error">{submitError}</Notice>}
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-900">
          Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="opening-warehouse" className="block text-sm font-medium text-slate-700">
              Warehouse
            </label>
            <select
              id="opening-warehouse"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              aria-invalid={Boolean(errors.warehouseId)}
              aria-describedby={errors.warehouseId ? 'opening-warehouse-error' : undefined}
              className={`${inputClass(Boolean(errors.warehouseId))} mt-1`}
            >
              <option value="">Choose a warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <FieldError id="opening-warehouse-error" message={errors.warehouseId} />
          </div>
          <div>
            <label htmlFor="opening-date" className="block text-sm font-medium text-slate-700">
              Stock date
            </label>
            <input
              id="opening-date"
              type="date"
              value={entryDate}
              max={today}
              onChange={(e) => setEntryDate(e.target.value)}
              aria-invalid={Boolean(errors.entryDate)}
              aria-describedby={errors.entryDate ? 'opening-date-error' : undefined}
              className={`${inputClass(Boolean(errors.entryDate))} mt-1`}
            />
            <FieldError id="opening-date-error" message={errors.entryDate} />
          </div>
          <div>
            <label htmlFor="opening-reference" className="block text-sm font-medium text-slate-700">
              Reference (optional)
            </label>
            <input
              id="opening-reference"
              type="text"
              maxLength={100}
              placeholder="e.g. old PO number"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              aria-invalid={Boolean(errors.reference)}
              aria-describedby={errors.reference ? 'opening-reference-error' : undefined}
              className={`${inputClass(Boolean(errors.reference))} mt-1`}
            />
            <FieldError id="opening-reference-error" message={errors.reference} />
          </div>
        </div>
        <div>
          <label htmlFor="opening-notes" className="block text-sm font-medium text-slate-700">
            Notes
          </label>
          <textarea
            id="opening-notes"
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={errors.notes ? 'opening-notes-error' : undefined}
            className={`${inputClass(Boolean(errors.notes))} mt-1`}
          />
          <FieldError id="opening-notes-error" message={errors.notes} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-900">
          Items in the warehouse
        </h2>
        {lines.map((line, index) => (
          <div key={line.key} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-start">
            <div>
              <label
                htmlFor={`opening-item-${line.key}`}
                className="block text-xs font-medium text-slate-600"
              >
                Item {index + 1}
              </label>
              <select
                id={`opening-item-${line.key}`}
                value={line.itemId}
                onChange={(e) => updateLine(line.key, { itemId: e.target.value })}
                aria-invalid={Boolean(errors[`lines.${index}.itemId`])}
                className={`${inputClass(Boolean(errors[`lines.${index}.itemId`]))} mt-1`}
              >
                <option value="">Choose an item</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <FieldError
                id={`opening-item-${line.key}-error`}
                message={errors[`lines.${index}.itemId`]}
              />
            </div>
            <div>
              <label
                htmlFor={`opening-qty-${line.key}`}
                className="block text-xs font-medium text-slate-600"
              >
                Quantity
              </label>
              <input
                id={`opening-qty-${line.key}`}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                aria-invalid={Boolean(errors[`lines.${index}.quantity`])}
                className={`${inputClass(Boolean(errors[`lines.${index}.quantity`]))} mt-1`}
              />
              <FieldError
                id={`opening-qty-${line.key}-error`}
                message={errors[`lines.${index}.quantity`]}
              />
            </div>
            <button
              type="button"
              onClick={() => setLines((all) => all.filter((l) => l.key !== line.key))}
              disabled={lines.length === 1}
              aria-label={`Remove item ${index + 1}`}
              className={`${secondaryButton} sm:mt-5`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setLines((all) => [...all, { key: nextKey.current++, itemId: '', quantity: '' }])
          }
          className={secondaryButton}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add item
        </button>
      </section>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={() => navigate('/stock?tab=opening')}
          className={secondaryButton}
        >
          Cancel
        </button>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Add to stock'}
        </button>
      </div>
    </form>
  );
}
