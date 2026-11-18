import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Info, Loader2 } from 'lucide-react';
import { ApiError, createReceipt, getPurchaseOrder } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  DocumentsEditor,
  documentsPayload,
  validateDocuments,
  type DocumentRow,
} from '../../components/Documents';
import { PurchaseOrderPicker } from '../../components/PurchaseOrderPicker';
import {
  BackLink,
  detailsToFieldErrors,
  ErrorPanel,
  FieldError,
  formatDateOnly,
  inputClass,
  LoadingRows,
  Notice,
  primaryButton,
  secondaryButton,
} from '../../components/ui';
import type { ReceiptPayload } from '../../contracts/operations';
import {
  DELIVERY_ROUTE_LABELS,
  todayInKarachi,
  type PurchaseOrderDetail,
} from '../../contracts/purchaseOrders';
import { useResource } from '../../hooks/useResource';

export function ReceiptFormPage() {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const [poId, setPoId] = useState(searchParams.get('purchaseOrderId') ?? '');
  const po = useResource(
    poId ? `po:${poId}` : null,
    (signal) => getPurchaseOrder(poId, signal),
    'The purchase order could not be loaded.',
  );

  if (session?.user.role !== 'OPERATOR') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">New receipt</h1>
        <Notice kind="error">Only the Production Operator can record receipts.</Notice>
        <BackLink to="/receiving">All receipts</BackLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink to="/receiving">All receipts</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New receipt</h1>
        <p className="mt-1 text-sm text-slate-600">
          Record goods received from a vendor against an open purchase order.
        </p>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <label htmlFor="receipt-po" className="block text-sm font-medium text-slate-700">
          Purchase order
        </label>
        <PurchaseOrderPicker
          id="receipt-po"
          value={poId}
          onChange={setPoId}
          eligible={(o) => o.completion !== 'COMPLETE'}
          emptyHint="No open purchase orders have quantities left to receive."
        />
      </section>

      {po.loading && <LoadingRows label="Loading purchase order" rows={4} />}
      {po.error && <ErrorPanel message={po.error} onRetry={po.notFound ? undefined : po.reload} />}
      {po.data && po.data.status === 'CANCELLED' && (
        <Notice kind="error">This purchase order is cancelled. Goods cannot be received.</Notice>
      )}
      {po.data &&
        po.data.status === 'OPEN' &&
        po.data.lines.every((l) => l.quantityRemaining <= 0) && (
          <Notice kind="success">Every line of this purchase order has been fully received.</Notice>
        )}
      {po.data &&
        po.data.status === 'OPEN' &&
        po.data.lines.some((l) => l.quantityRemaining > 0) &&
        session && <ReceiptForm key={po.data.id} po={po.data} csrfToken={session.csrfToken} />}
    </div>
  );
}

function ReceiptForm({ po, csrfToken }: { po: PurchaseOrderDetail; csrfToken: string }) {
  const { handleApiError } = useAuth();
  const navigate = useNavigate();
  const today = todayInKarachi();
  const [receiptDate, setReceiptDate] = useState(today);
  const [vendorChallanNo, setVendorChallanNo] = useState('');
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const showError = (message: string) => {
    setSubmitError(message);
    errorRef.current?.focus();
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!receiptDate) next.receiptDate = 'Receipt date is required';
    else if (receiptDate > today) next.receiptDate = 'Receipt date cannot be in the future';
    else if (receiptDate < po.poDate)
      next.receiptDate = `Receipt date cannot be before the PO date (${formatDateOnly(po.poDate)})`;

    const lines: ReceiptPayload['lines'] = [];
    for (const line of po.lines) {
      const raw = (quantities[line.id] ?? '').trim();
      if (!raw) continue;
      const qty = Number(raw);
      if (!Number.isInteger(qty) || qty < 1) {
        next[`line.${line.id}`] = 'Enter a whole number of at least 1';
      } else if (qty > line.quantityRemaining) {
        next[`line.${line.id}`] =
          `Cannot receive more than the remaining ${line.quantityRemaining.toLocaleString()}`;
      } else {
        lines.push({ poLineId: line.id, quantity: qty });
      }
    }
    const lineErrors = Object.keys(next).some((k) => k.startsWith('line.'));
    if (lines.length === 0 && !lineErrors) next.lines = 'Enter a quantity for at least one line';
    validateDocuments(documents, next);

    setErrors(next);
    if (Object.keys(next).length > 0) {
      showError('Please fix the errors below.');
      return;
    }

    const payload: ReceiptPayload = {
      purchaseOrderId: po.id,
      receiptDate,
      vendorChallanNo: vendorChallanNo.trim() || null,
      notes: notes.trim() || null,
      documents: documentsPayload(documents),
      lines,
    };
    setSaving(true);
    setSubmitError(null);
    try {
      const created = await createReceipt(payload, csrfToken);
      navigate(`/receiving/${created.id}`, {
        state: { notice: `Receipt ${created.code} recorded.` },
      });
    } catch (err) {
      if (handleApiError(err)) return;
      if (err instanceof ApiError && err.details.length > 0) {
        const mapped = detailsToFieldErrors(err);
        // Server line paths refer to the submitted lines; show them next to the PO line.
        for (const [path, message] of Object.entries(mapped)) {
          const match = /^lines\.(\d+)/.exec(path);
          const line = match ? lines[Number(match[1])] : undefined;
          if (line) mapped[`line.${line.poLineId}`] = message;
        }
        setErrors(mapped);
        showError(err.message || 'The server rejected some entries. Check the highlighted fields.');
      } else {
        showError(err instanceof ApiError ? err.message : 'The receipt could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  const location =
    po.deliveryRoute === 'WAREHOUSE'
      ? (po.targetWarehouse?.name ?? '—')
      : po.destinationDivision
        ? `${po.destinationDivision.name}${po.destinationDivision.provinceName ? `, ${po.destinationDivision.provinceName}` : ''}`
        : '—';

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div ref={errorRef} tabIndex={-1} className="outline-none">
        {submitError && <Notice kind="error">{submitError}</Notice>}
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-900">
          Receipt details
        </h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Vendor</dt>
            <dd className="mt-1 font-medium text-slate-900">{po.vendor.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Delivery route</dt>
            <dd className="mt-1 font-medium text-slate-900">
              {DELIVERY_ROUTE_LABELS[po.deliveryRoute]}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">
              {po.deliveryRoute === 'WAREHOUSE'
                ? 'Received into warehouse'
                : 'Delivered to division'}
            </dt>
            <dd className="mt-1 font-medium text-slate-900">{location}</dd>
          </div>
        </dl>
        {po.deliveryRoute === 'DIRECT' && (
          <p className="flex gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Direct deliveries go straight to the division. They are recorded at the division and are
            not warehouse stock.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="receipt-date" className="block text-sm font-medium text-slate-700">
              Receipt date
            </label>
            <input
              id="receipt-date"
              type="date"
              value={receiptDate}
              min={po.poDate}
              max={today}
              onChange={(e) => setReceiptDate(e.target.value)}
              aria-invalid={Boolean(errors.receiptDate)}
              aria-describedby={errors.receiptDate ? 'receipt-date-error' : undefined}
              className={`${inputClass(Boolean(errors.receiptDate))} mt-1`}
            />
            <FieldError id="receipt-date-error" message={errors.receiptDate} />
          </div>
          <div>
            <label htmlFor="receipt-challan" className="block text-sm font-medium text-slate-700">
              Vendor challan no.
            </label>
            <input
              id="receipt-challan"
              type="text"
              maxLength={50}
              value={vendorChallanNo}
              onChange={(e) => setVendorChallanNo(e.target.value)}
              aria-invalid={Boolean(errors.vendorChallanNo)}
              aria-describedby={errors.vendorChallanNo ? 'receipt-challan-error' : undefined}
              className={`${inputClass(Boolean(errors.vendorChallanNo))} mt-1`}
            />
            <FieldError id="receipt-challan-error" message={errors.vendorChallanNo} />
          </div>
        </div>
        <div>
          <label htmlFor="receipt-notes" className="block text-sm font-medium text-slate-700">
            Notes
          </label>
          <textarea
            id="receipt-notes"
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-invalid={Boolean(errors.notes)}
            aria-describedby={errors.notes ? 'receipt-notes-error' : undefined}
            className={`${inputClass(Boolean(errors.notes))} mt-1`}
          />
          <FieldError id="receipt-notes-error" message={errors.notes} />
        </div>
        <DocumentsEditor
          rows={documents}
          onChange={setDocuments}
          errors={errors}
          uploadPurpose="receipt"
          hint="e.g. vendor challan photo"
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Quantities received</h2>
          <p className="text-sm text-slate-500">
            Leave a line empty if nothing was received for it. You cannot receive more than the
            remaining quantity.
          </p>
        </div>
        {errors.lines && <Notice kind="error">{errors.lines}</Notice>}
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <caption className="sr-only">Purchase order lines</caption>
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Line
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Item
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Ordered
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Received
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Remaining
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Receive now
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {po.lines.map((line) => {
                const error = errors[`line.${line.id}`];
                const done = line.quantityRemaining <= 0;
                return (
                  <tr key={line.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">#{line.lineNo}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{line.item.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {line.quantityOrdered.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {line.quantityReceived.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {line.quantityRemaining.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {done ? (
                        <span className="text-xs text-slate-500">Fully received</span>
                      ) : (
                        <>
                          <input
                            type="number"
                            min={1}
                            max={line.quantityRemaining}
                            step={1}
                            inputMode="numeric"
                            value={quantities[line.id] ?? ''}
                            onChange={(e) =>
                              setQuantities((q) => ({ ...q, [line.id]: e.target.value }))
                            }
                            aria-label={`Line ${line.lineNo} quantity to receive`}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? `line-${line.id}-error` : undefined}
                            className={`${inputClass(Boolean(error))} w-32`}
                          />
                          <FieldError id={`line-${line.id}-error`} message={error} />
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="button" onClick={() => navigate('/receiving')} className={secondaryButton}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Record receipt'}
        </button>
      </div>
    </form>
  );
}
