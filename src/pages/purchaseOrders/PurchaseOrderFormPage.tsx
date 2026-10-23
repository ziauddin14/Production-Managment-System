import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import {
  ApiError,
  createPurchaseOrder,
  getPurchaseOrder,
  listAllMasterRecords,
  listDemands,
  updatePurchaseOrder,
} from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  ErrorPanel,
  inputClass,
  LoadingRows,
  Notice,
  primaryButton,
  secondaryButton,
} from '../../components/ui';
import {
  todayInKarachi,
  type DeliveryRoute,
  type MasterRef,
  type PurchaseOrderDetail,
  type PurchaseOrderPayload,
} from '../../contracts/purchaseOrders';
import type { DemandSummary } from '../../contracts/demands';
import type { MasterRecord } from '../../contracts/masterData';

interface LineState {
  key: string;
  id?: string;
  itemId: string;
  demandId: string;
  demandLineId: string;
  quantityOrdered: string;
  unitPrice: string;
  notes: string;
}

interface ScheduleState {
  key: string;
  entryNo: number;
  dueDate: string;
  plannedAmount: string;
  note: string;
}

interface Options {
  vendors: MasterRecord[];
  warehouses: MasterRecord[];
  divisions: MasterRecord[];
  items: MasterRecord[];
  demands: DemandSummary[];
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; options: Options; po: PurchaseOrderDetail | null };

let keySeq = 0;
const newKey = () => `po-key-${(keySeq += 1)}`;

const emptyLine = (): LineState => ({
  key: newKey(),
  itemId: '',
  demandId: '',
  demandLineId: '',
  quantityOrdered: '',
  unitPrice: '',
  notes: '',
});

const emptySchedule = (entryNo: number): ScheduleState => ({
  key: newKey(),
  entryNo,
  dueDate: '',
  plannedAmount: '',
  note: '',
});

function withCurrent(list: MasterRecord[], ref: MasterRef | null | undefined, extra?: object) {
  if (!ref || list.some((r) => r.id === ref.id)) return list;
  return [
    ...list,
    {
      ...ref,
      name: `${ref.name} (inactive)`,
      rev: 0,
      createdAt: '',
      updatedAt: '',
      ...extra,
    } as MasterRecord,
  ];
}

export function PurchaseOrderFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { session, handleApiError } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    Promise.all([
      listAllMasterRecords('vendors', 'active', signal),
      listAllMasterRecords('warehouses', 'active', signal),
      listAllMasterRecords('divisions', 'active', signal),
      listAllMasterRecords('items', 'active', signal),
      listDemands({ status: 'open', pageSize: 100 }, signal)
        .then((res) => res.items)
        .catch(() => []),
      id ? getPurchaseOrder(id, signal) : Promise.resolve(null),
    ])
      .then(([vendors, warehouses, divisions, items, demands, po]) =>
        setState({
          kind: 'ready',
          options: { vendors, warehouses, divisions, items, demands },
          po,
        }),
      )
      .catch((error: unknown) => {
        if (signal.aborted || handleApiError(error)) return;
        setState({
          kind: 'error',
          message: error instanceof ApiError ? error.message : 'The form could not be loaded.',
        });
      });
    return () => controller.abort();
  }, [id, handleApiError]);

  if (session?.user.role !== 'OPERATOR') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Purchase orders</h1>
        <Notice kind="error">
          Only the Production Operator can create or change purchase orders.
        </Notice>
        <Link
          to="/purchase-orders"
          className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
        >
          ← All purchase orders
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={id ? `/purchase-orders/${id}` : '/purchase-orders'}
        className="inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        ← {id ? 'Back to purchase order' : 'All purchase orders'}
      </Link>
      {state.kind === 'loading' && <LoadingRows label="Loading form" rows={6} />}
      {state.kind === 'error' && <ErrorPanel message={state.message} />}
      {state.kind === 'ready' && state.po?.status === 'CANCELLED' && (
        <Notice kind="error">This purchase order is cancelled and cannot be changed.</Notice>
      )}
      {state.kind === 'ready' && state.po?.status !== 'CANCELLED' && (
        <PurchaseOrderForm
          options={state.options}
          po={state.po}
          editing={editing}
          csrfToken={session.csrfToken}
          onSaved={(saved) =>
            navigate(`/purchase-orders/${saved.id}`, {
              state: {
                notice: editing ? `Saved ${saved.code}.` : `Created purchase order ${saved.code}.`,
              },
            })
          }
          onApiError={handleApiError}
        />
      )}
    </div>
  );
}

function PurchaseOrderForm({
  options,
  po,
  editing,
  csrfToken,
  onSaved,
  onApiError,
}: {
  options: Options;
  po: PurchaseOrderDetail | null;
  editing: boolean;
  csrfToken: string;
  onSaved(po: PurchaseOrderDetail): void;
  onApiError(error: unknown): boolean;
}) {
  const today = todayInKarachi();
  const [poNumber, setPoNumber] = useState(po?.poNumber ?? '');
  const [poDate, setPoDate] = useState(po?.poDate ?? today);
  const [vendorId, setVendorId] = useState(po?.vendor.id ?? '');
  const [deliveryRoute, setDeliveryRoute] = useState<DeliveryRoute>(
    po?.deliveryRoute ?? 'WAREHOUSE',
  );
  const [targetWarehouseId, setTargetWarehouseId] = useState(po?.targetWarehouse?.id ?? '');
  const [destinationDivisionId, setDestinationDivisionId] = useState(
    po?.destinationDivision?.id ?? '',
  );
  const [approvedAmount, setApprovedAmount] = useState(po ? String(po.approvedAmount) : '');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState(
    po?.expectedCompletionDate ?? '',
  );
  const [notes, setNotes] = useState(po?.notes ?? '');

  // Invoice fields
  const [invoiceNo, setInvoiceNo] = useState(po?.invoice?.invoiceNo ?? '');
  const [invoiceDate, setInvoiceDate] = useState(po?.invoice?.invoiceDate ?? '');
  const [invoiceAmount, setInvoiceAmount] = useState(
    po?.invoice?.invoiceAmount !== null && po?.invoice?.invoiceAmount !== undefined
      ? String(po.invoice.invoiceAmount)
      : '',
  );
  const [invoiceNotes, setInvoiceNotes] = useState(po?.invoice?.notes ?? '');

  // Payment schedule
  const [schedule, setSchedule] = useState<ScheduleState[]>(
    po && po.paymentSchedule.length > 0
      ? po.paymentSchedule.map((s) => ({
          key: newKey(),
          entryNo: s.entryNo,
          dueDate: s.dueDate,
          plannedAmount: String(s.plannedAmount),
          note: s.note ?? '',
        }))
      : [],
  );

  // Lines
  const [lines, setLines] = useState<LineState[]>(
    po
      ? po.lines.map((l) => ({
          key: newKey(),
          id: l.id,
          itemId: l.item.id,
          demandId: l.demand?.id ?? '',
          demandLineId: l.demand?.lineNo ? String(l.demand.lineNo) : '',
          quantityOrdered: String(l.quantityOrdered),
          unitPrice: String(l.unitPrice),
          notes: l.notes ?? '',
        }))
      : [emptyLine()],
  );

  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const errorRef = useRef<HTMLDivElement>(null);

  // Preserve inactive records when editing an existing order
  const vendors = useMemo(() => withCurrent(options.vendors, po?.vendor), [options.vendors, po]);
  const warehouses = useMemo(
    () => withCurrent(options.warehouses, po?.targetWarehouse),
    [options.warehouses, po],
  );
  const divisions = useMemo(
    () => withCurrent(options.divisions, po?.destinationDivision),
    [options.divisions, po],
  );
  const items = useMemo(() => {
    let list = options.items;
    for (const l of po?.lines ?? []) list = withCurrent(list, l.item);
    return list;
  }, [options.items, po]);

  // Derived calculations
  const totalAmount = useMemo(() => {
    return lines.reduce((sum, line) => {
      const q = parseFloat(line.quantityOrdered) || 0;
      const p = parseFloat(line.unitPrice) || 0;
      return sum + q * p;
    }, 0);
  }, [lines]);

  const totalQuantity = useMemo(() => {
    return lines.reduce((sum, line) => sum + (parseInt(line.quantityOrdered, 10) || 0), 0);
  }, [lines]);

  const totalScheduled = useMemo(() => {
    return schedule.reduce((sum, s) => sum + (parseFloat(s.plannedAmount) || 0), 0);
  }, [schedule]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const clientErrors: Record<string, string> = {};

    if (!poNumber.trim()) clientErrors.poNumber = 'PO number is required';
    if (!poDate) clientErrors.poDate = 'Date is required';
    else if (poDate > today) clientErrors.poDate = 'Date cannot be in the future';
    else if (poDate < '2000-01-01') clientErrors.poDate = 'Date must be on or after 2000-01-01';

    if (!vendorId) clientErrors.vendorId = 'Select a vendor';

    if (deliveryRoute === 'WAREHOUSE' && !targetWarehouseId) {
      clientErrors.targetWarehouseId = 'Select a target warehouse';
    }
    if (deliveryRoute === 'DIRECT' && !destinationDivisionId) {
      clientErrors.destinationDivisionId = 'Select a destination division';
    }

    const appAmountNum = parseFloat(approvedAmount);
    if (!approvedAmount.trim() || Number.isNaN(appAmountNum) || appAmountNum < 0) {
      clientErrors.approvedAmount = 'Enter a valid approved amount (0 or more)';
    }

    if (lines.length === 0) {
      clientErrors.general = 'Add at least one line';
    }

    const seenItemDemandPairs = new Set<string>();
    lines.forEach((line, index) => {
      const linePath = `lines.${index}`;
      if (!line.itemId) clientErrors[`${linePath}.itemId`] = 'Select an item';

      const pairKey = `${line.itemId}:${line.demandLineId || 'unlinked'}`;
      if (line.itemId && seenItemDemandPairs.has(pairKey)) {
        clientErrors[`${linePath}.itemId`] =
          'This item is already listed for this demand line. Combine the quantities instead.';
      } else if (line.itemId) {
        seenItemDemandPairs.add(pairKey);
      }

      const q = parseInt(line.quantityOrdered, 10);
      if (
        !line.quantityOrdered ||
        Number.isNaN(q) ||
        q <= 0 ||
        !Number.isInteger(Number(line.quantityOrdered))
      ) {
        clientErrors[`${linePath}.quantityOrdered`] = 'Quantity must be a whole number ≥ 1';
      }

      const p = parseFloat(line.unitPrice);
      if (!line.unitPrice || Number.isNaN(p) || p < 0) {
        clientErrors[`${linePath}.unitPrice`] = 'Price must be 0 or more';
      }
    });

    schedule.forEach((s, index) => {
      const sPath = `paymentSchedule.${index}`;
      if (!s.dueDate) clientErrors[`${sPath}.dueDate`] = 'Due date is required';
      const amt = parseFloat(s.plannedAmount);
      if (!s.plannedAmount || Number.isNaN(amt) || amt <= 0) {
        clientErrors[`${sPath}.plannedAmount`] = 'Amount must be greater than 0';
      }
    });

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setSubmitError('Please fix the errors below.');
      errorRef.current?.focus();
      if (typeof errorRef.current?.scrollIntoView === 'function') {
        errorRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    const payload: PurchaseOrderPayload = {
      poNumber: poNumber.trim(),
      poDate,
      vendorId,
      deliveryRoute,
      targetWarehouseId: deliveryRoute === 'WAREHOUSE' ? targetWarehouseId : null,
      destinationDivisionId: deliveryRoute === 'DIRECT' ? destinationDivisionId : null,
      approvedAmount: parseFloat(approvedAmount) || 0,
      expectedCompletionDate: expectedCompletionDate || null,
      notes: notes.trim() || null,
      invoice:
        invoiceNo.trim() || invoiceDate || invoiceAmount.trim() || invoiceNotes.trim()
          ? {
              invoiceNo: invoiceNo.trim() || null,
              invoiceDate: invoiceDate || null,
              invoiceAmount: invoiceAmount.trim() ? parseFloat(invoiceAmount) : null,
              notes: invoiceNotes.trim() || null,
            }
          : null,
      paymentSchedule: schedule.map((s, index) => ({
        entryNo: index + 1,
        dueDate: s.dueDate,
        plannedAmount: parseFloat(s.plannedAmount) || 0,
        note: s.note.trim() || null,
      })),
      lines: lines.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        itemId: l.itemId,
        demandId: l.demandId || null,
        demandLineId: l.demandLineId || null,
        quantityOrdered: parseInt(l.quantityOrdered, 10),
        unitPrice: parseFloat(l.unitPrice) || 0,
        notes: l.notes.trim() || null,
      })),
    };

    setSaving(true);
    try {
      if (editing && po) {
        const updated = await updatePurchaseOrder(po.id, { ...payload, rev: po.rev }, csrfToken);
        onSaved(updated);
      } else {
        const created = await createPurchaseOrder(payload, csrfToken);
        onSaved(created);
      }
    } catch (err: unknown) {
      if (onApiError(err)) return;
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setSubmitError(
            'This purchase order was modified by someone else in the meantime. Please reload to see the latest changes.',
          );
        } else if (err.details && err.details.length > 0) {
          const map: Record<string, string> = {};
          for (const d of err.details) map[d.path] = d.message;
          setFieldErrors(map);
          setSubmitError('The server rejected some entries. Check the highlighted fields.');
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError('An unexpected error occurred while saving.');
      }
      errorRef.current?.focus();
      if (typeof errorRef.current?.scrollIntoView === 'function') {
        errorRef.current.scrollIntoView({ behavior: 'smooth' });
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {editing ? `Edit purchase order ${po?.poNumber}` : 'New purchase order'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {editing
              ? 'Update operational order details, vendor, delivery routes and schedules.'
              : 'Register a new purchase order for production inventory or direct dispatches.'}
          </p>
        </div>
      </div>

      {/* Header Fields Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Order Details
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              PO Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. DIT/0189"
              className={`${inputClass(Boolean(fieldErrors.poNumber))} mt-1`}
              aria-label="PO Number"
              required
            />
            {fieldErrors.poNumber && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.poNumber}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              PO Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={poDate}
              onChange={(e) => setPoDate(e.target.value)}
              max={today}
              className={`${inputClass(Boolean(fieldErrors.poDate))} mt-1`}
              aria-label="PO Date"
              required
            />
            {fieldErrors.poDate && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.poDate}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Vendor <span className="text-red-500">*</span>
            </label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className={`${inputClass(Boolean(fieldErrors.vendorId))} mt-1`}
              aria-label="Vendor"
              required
            >
              <option value="">Select a vendor...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {!v.active && !v.name.includes('(inactive)') ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
            {fieldErrors.vendorId && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.vendorId}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Approved Amount (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(e.target.value)}
              placeholder="0"
              className={`${inputClass(Boolean(fieldErrors.approvedAmount))} mt-1`}
              aria-label="Approved Amount"
              required
            />
            {fieldErrors.approvedAmount && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.approvedAmount}</p>
            )}
          </div>
        </div>

        {/* Route Selection */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Delivery Route <span className="text-red-500">*</span>
            </label>
            <select
              value={deliveryRoute}
              onChange={(e) => setDeliveryRoute(e.target.value as DeliveryRoute)}
              className={`${inputClass()} mt-1`}
              aria-label="Delivery Route"
            >
              <option value="WAREHOUSE">Warehouse route (Vendor → Warehouse)</option>
              <option value="DIRECT">Direct route (Vendor → Division)</option>
            </select>
          </div>

          {deliveryRoute === 'WAREHOUSE' ? (
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Target Warehouse <span className="text-red-500">*</span>
              </label>
              <select
                value={targetWarehouseId}
                onChange={(e) => setTargetWarehouseId(e.target.value)}
                className={`${inputClass(Boolean(fieldErrors.targetWarehouseId))} mt-1`}
                aria-label="Target Warehouse"
                required
              >
                <option value="">Select target warehouse...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {!w.active && !w.name.includes('(inactive)') ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.targetWarehouseId && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.targetWarehouseId}</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Destination Division <span className="text-red-500">*</span>
              </label>
              <select
                value={destinationDivisionId}
                onChange={(e) => setDestinationDivisionId(e.target.value)}
                className={`${inputClass(Boolean(fieldErrors.destinationDivisionId))} mt-1`}
                aria-label="Destination Division"
                required
              >
                <option value="">Select destination division...</option>
                {divisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {!d.active && !d.name.includes('(inactive)') ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
              {fieldErrors.destinationDivisionId && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.destinationDivisionId}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700">
              Expected Completion Date
            </label>
            <input
              type="date"
              value={expectedCompletionDate}
              onChange={(e) => setExpectedCompletionDate(e.target.value)}
              className={`${inputClass(Boolean(fieldErrors.expectedCompletionDate))} mt-1`}
              aria-label="Expected Completion Date"
            />
            {fieldErrors.expectedCompletionDate && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.expectedCompletionDate}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Operational notes, reference..."
              className={`${inputClass()} mt-1`}
              aria-label="Notes"
            />
          </div>
        </div>
      </div>

      {/* Line Items Editor */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Item Lines</h2>
            <p className="text-xs text-slate-500">
              Each line represents an item ordered from the vendor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            className={`${secondaryButton} text-xs py-1.5`}
          >
            <Plus className="h-3.5 w-3.5" />
            Add line
          </button>
        </div>

        {fieldErrors.lines && <Notice kind="error">{fieldErrors.lines}</Notice>}

        <div className="space-y-3">
          {lines.map((line, idx) => {
            const linePath = `lines.${idx}`;
            const q = parseFloat(line.quantityOrdered) || 0;
            const p = parseFloat(line.unitPrice) || 0;
            const lineTotal = q * p;

            return (
              <div
                key={line.key}
                className="rounded-md border border-slate-200 bg-slate-50/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-700">Line #{idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Remove line"
                      aria-label={`Remove line ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Item <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={line.itemId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, itemId: val } : l)),
                        );
                      }}
                      className={`${inputClass(Boolean(fieldErrors[`${linePath}.itemId`]))} mt-1`}
                      aria-label={`Line ${idx + 1} Item`}
                      required
                    >
                      <option value="">Select item...</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                          {!it.active && !it.name.includes('(inactive)') ? ' (inactive)' : ''}
                        </option>
                      ))}
                    </select>
                    {fieldErrors[`${linePath}.itemId`] && (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors[`${linePath}.itemId`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Link Demand (Optional)
                    </label>
                    <select
                      value={line.demandId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, demandId: val, demandLineId: '' } : l,
                          ),
                        );
                      }}
                      className={`${inputClass()} mt-1`}
                      aria-label={`Line ${idx + 1} Demand`}
                    >
                      <option value="">No demand link</option>
                      {options.demands.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.code} ({d.demandDate})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Quantity (pcs) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantityOrdered}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, quantityOrdered: val } : l)),
                        );
                      }}
                      placeholder="1"
                      className={`${inputClass(Boolean(fieldErrors[`${linePath}.quantityOrdered`]))} mt-1`}
                      aria-label={`Line ${idx + 1} Quantity`}
                      required
                    />
                    {fieldErrors[`${linePath}.quantityOrdered`] && (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors[`${linePath}.quantityOrdered`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Unit Price (PKR) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.unitPrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, unitPrice: val } : l)),
                        );
                      }}
                      placeholder="0"
                      className={`${inputClass(Boolean(fieldErrors[`${linePath}.unitPrice`]))} mt-1`}
                      aria-label={`Line ${idx + 1} Unit Price`}
                      required
                    />
                    {fieldErrors[`${linePath}.unitPrice`] && (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors[`${linePath}.unitPrice`]}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                  <div className="flex-1 mr-4">
                    <input
                      type="text"
                      value={line.notes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, notes: val } : l)),
                        );
                      }}
                      placeholder="Optional line note..."
                      className={`${inputClass()} py-1 text-xs`}
                    />
                  </div>
                  <div className="text-right whitespace-nowrap text-slate-700 font-semibold">
                    Line total: PKR {lineTotal.toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Lines summary bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 p-4 rounded-md border border-slate-200">
          <div className="text-sm text-slate-700">
            Total quantity:{' '}
            <strong className="text-slate-900">{totalQuantity.toLocaleString()}</strong> pcs across{' '}
            <strong className="text-slate-900">{lines.length}</strong>{' '}
            {lines.length === 1 ? 'item' : 'items'}
          </div>
          <div className="text-right text-base font-bold text-slate-900 mt-2 sm:mt-0">
            Total line amount: PKR {totalAmount.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Payment Schedule Editor */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Planned Payment Schedule</h2>
            <p className="text-xs text-slate-500">
              Record the planned payment instalments and due dates (CD-05).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSchedule((prev) => [...prev, emptySchedule(prev.length + 1)])}
            className={`${secondaryButton} text-xs py-1.5`}
          >
            <Plus className="h-3.5 w-3.5" />
            Add instalment
          </button>
        </div>

        {schedule.length === 0 ? (
          <p className="text-sm text-slate-500 italic py-2">
            No planned payment instalments added. Click "Add instalment" to plan payments.
          </p>
        ) : (
          <div className="space-y-3">
            {schedule.map((entry, idx) => {
              const sPath = `paymentSchedule.${idx}`;
              return (
                <div
                  key={entry.key}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end bg-slate-50 p-3 rounded-md border border-slate-200"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Due Date #{idx + 1} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={entry.dueDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSchedule((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, dueDate: val } : s)),
                        );
                      }}
                      className={`${inputClass(Boolean(fieldErrors[`${sPath}.dueDate`]))} mt-1`}
                      required
                    />
                    {fieldErrors[`${sPath}.dueDate`] && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors[`${sPath}.dueDate`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Amount (PKR) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={entry.plannedAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSchedule((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, plannedAmount: val } : s)),
                        );
                      }}
                      placeholder="0"
                      className={`${inputClass(Boolean(fieldErrors[`${sPath}.plannedAmount`]))} mt-1`}
                      required
                    />
                    {fieldErrors[`${sPath}.plannedAmount`] && (
                      <p className="mt-1 text-xs text-red-600">
                        {fieldErrors[`${sPath}.plannedAmount`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">Note</label>
                    <input
                      type="text"
                      value={entry.note}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSchedule((prev) =>
                          prev.map((s, i) => (i === idx ? { ...s, note: val } : s)),
                        );
                      }}
                      placeholder="e.g. 50% Advance"
                      className={`${inputClass()} mt-1`}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSchedule((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-red-600 hover:text-red-800 p-2"
                      title="Remove instalment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="text-right text-xs text-slate-600 font-medium">
              Total planned payments: PKR {totalScheduled.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Invoice Details Section */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
          Invoice Information (1 per PO)
        </h2>
        <p className="text-xs text-slate-500">
          Associate the vendor invoice with this purchase order (CD-02).
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Invoice Number</label>
            <input
              type="text"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="e.g. INV-1002"
              className={`${inputClass()} mt-1`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className={`${inputClass()} mt-1`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Invoice Amount (PKR)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
              placeholder="0"
              className={`${inputClass()} mt-1`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700">Invoice Notes</label>
          <input
            type="text"
            value={invoiceNotes}
            onChange={(e) => setInvoiceNotes(e.target.value)}
            placeholder="Invoice details, payment instructions, etc."
            className={`${inputClass()} mt-1`}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <Link
          to={editing && po ? `/purchase-orders/${po.id}` : '/purchase-orders'}
          className={secondaryButton}
        >
          Cancel
        </Link>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Saving...' : editing ? 'Save changes' : 'Create purchase order'}
        </button>
      </div>
    </form>
  );
}
