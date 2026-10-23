import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { AlertTriangle, ArrowLeft, CreditCard, Edit, FileText, Truck, XCircle } from 'lucide-react';
import { ApiError, cancelPurchaseOrder, getPurchaseOrder } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  ErrorPanel,
  formatDateOnly,
  formatDateTime,
  inputClass,
  LoadingRows,
  Notice,
  secondaryButton,
  StatusBadge,
} from '../../components/ui';
import {
  DELIVERY_ROUTE_LABELS,
  PO_COMPLETION_LABELS,
  type PurchaseOrderDetail,
} from '../../contracts/purchaseOrders';

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session, handleApiError } = useAuth();
  const canWrite = session?.user.role === 'OPERATOR';

  const [reload, setReload] = useState(0);
  type Result =
    | { key: string; kind: 'ready'; po: PurchaseOrderDetail }
    | { key: string; kind: 'error'; message: string; notFound: boolean };
  const [result, setResult] = useState<Result | null>(null);
  const requestKey = `${id}:${reload}`;

  // Cancellation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getPurchaseOrder(id, controller.signal)
      .then((data) => setResult({ key: requestKey, kind: 'ready', po: data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted || handleApiError(err)) return;
        setResult({
          key: requestKey,
          kind: 'error',
          message: err instanceof ApiError ? err.message : 'Failed to load purchase order.',
          notFound: err instanceof ApiError && err.status === 404,
        });
      });
    return () => controller.abort();
  }, [id, requestKey, handleApiError]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);
  const loading = result === null || result.key !== requestKey;
  const po = !loading && result?.kind === 'ready' ? result.po : null;
  const error = !loading && result?.kind === 'error' ? result.message : null;

  const onCancelSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!po || !session) return;
    const trimmed = cancelReason.trim();
    if (!trimmed) {
      setCancelError('Please provide a cancellation reason.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      const updated = await cancelPurchaseOrder(
        po.id,
        { rev: po.rev, reason: trimmed },
        session.csrfToken,
      );
      setResult({ key: requestKey, kind: 'ready', po: updated });
      setShowCancelModal(false);
      setCancelReason('');
    } catch (err: unknown) {
      if (handleApiError(err)) return;
      setCancelError(err instanceof ApiError ? err.message : 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <LoadingRows label="Loading purchase order details" rows={8} />;
  }

  if (error || !po) {
    return (
      <div className="space-y-4">
        <Link
          to="/purchase-orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to purchase orders
        </Link>
        <ErrorPanel
          message={error || 'Purchase order not found'}
          onRetry={result?.kind === 'error' && result.notFound ? undefined : refresh}
        />
      </div>
    );
  }

  const isCancelled = po.status === 'CANCELLED';
  const totalScheduled = po.paymentSchedule.reduce((sum, s) => sum + s.plannedAmount, 0);

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/purchase-orders"
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-800 hover:underline mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to purchase orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{po.poNumber}</h1>
            <span className="font-mono text-sm text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {po.code}
            </span>
            <StatusBadge tone={isCancelled ? 'grey' : 'green'}>
              {isCancelled ? 'Cancelled' : 'Open'}
            </StatusBadge>
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
          </div>
        </div>

        {canWrite && !isCancelled && (
          <div className="flex items-center gap-2">
            <Link to={`/purchase-orders/${po.id}/edit`} className={secondaryButton}>
              <Edit className="h-4 w-4" />
              Edit
            </Link>
            <button
              type="button"
              onClick={() => {
                setCancelReason('');
                setCancelError(null);
                setShowCancelModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <XCircle className="h-4 w-4" />
              Cancel PO
            </button>
          </div>
        )}
      </div>

      {/* Cancellation Notice Banner */}
      {isCancelled && po.cancellation && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="flex items-center gap-2 font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            This purchase order was cancelled on {formatDateTime(po.cancellation.at)}
            {po.cancellation.by ? ` by ${po.cancellation.by}` : ''}
          </div>
          <p className="mt-1 text-red-700">
            <span className="font-medium">Reason: </span>
            {po.cancellation.reason}
          </p>
        </div>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Order Details & Logistics */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 font-semibold text-slate-800">
            <Truck className="h-4 w-4 text-emerald-700" />
            Order & Logistics
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">PO Date</span>
              <span className="font-medium text-slate-900">{formatDateOnly(po.poDate)}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Vendor</span>
              <span className="font-medium text-slate-900">
                {po.vendor.name}
                {!po.vendor.active && (
                  <span className="ml-1 text-xs text-amber-700">(inactive)</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Delivery Route</span>
              <span className="font-medium text-slate-900">
                {DELIVERY_ROUTE_LABELS[po.deliveryRoute]}
              </span>
            </div>
            {po.deliveryRoute === 'WAREHOUSE' ? (
              <div>
                <span className="text-slate-500 block text-xs">Target Warehouse</span>
                <span className="font-medium text-slate-900">
                  {po.targetWarehouse?.name ?? '—'}
                  {po.targetWarehouse && !po.targetWarehouse.active && (
                    <span className="ml-1 text-xs text-amber-700">(inactive)</span>
                  )}
                </span>
              </div>
            ) : (
              <div>
                <span className="text-slate-500 block text-xs">Destination Division</span>
                <span className="font-medium text-slate-900">
                  {po.destinationDivision
                    ? `${po.destinationDivision.name}${
                        po.destinationDivision.provinceName
                          ? `, ${po.destinationDivision.provinceName}`
                          : ''
                      }`
                    : '—'}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-500 block text-xs">Expected Completion Date</span>
              <span className="font-medium text-slate-900">
                {po.expectedCompletionDate ? formatDateOnly(po.expectedCompletionDate) : '—'}
              </span>
            </div>
            {po.notes && (
              <div>
                <span className="text-slate-500 block text-xs">Notes</span>
                <p className="text-slate-700 whitespace-pre-wrap">{po.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Financial & Schedule Summary */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 font-semibold text-slate-800">
            <CreditCard className="h-4 w-4 text-emerald-700" />
            Financial Planning
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-slate-500 block text-xs">Approved PO Amount</span>
              <span className="text-lg font-bold text-slate-900">
                PKR {po.approvedAmount.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Sum of Item Lines</span>
              <span className="font-medium text-slate-900">
                PKR {po.totalAmount.toLocaleString()}
              </span>
              {po.totalAmount !== po.approvedAmount && (
                <div className="mt-1 text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
                  Approved amount differs from line total by PKR{' '}
                  {Math.abs(po.approvedAmount - po.totalAmount).toLocaleString()}
                </div>
              )}
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Planned Payment Schedule</span>
              <span className="text-xs text-slate-600">
                {po.paymentSchedule.length}{' '}
                {po.paymentSchedule.length === 1 ? 'instalment' : 'instalments'} planned (Total: PKR{' '}
                {totalScheduled.toLocaleString()})
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Metadata */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2 font-semibold text-slate-800">
            <FileText className="h-4 w-4 text-emerald-700" />
            Invoice Record (1 per PO)
          </div>
          {po.invoice && (po.invoice.invoiceNo || po.invoice.invoiceAmount !== null) ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-slate-500 block text-xs">Invoice Number</span>
                <span className="font-semibold text-slate-900">{po.invoice.invoiceNo ?? '—'}</span>
              </div>
              {po.invoice.invoiceDate && (
                <div>
                  <span className="text-slate-500 block text-xs">Invoice Date</span>
                  <span className="font-medium text-slate-900">
                    {formatDateOnly(po.invoice.invoiceDate)}
                  </span>
                </div>
              )}
              {po.invoice.invoiceAmount !== null && (
                <div>
                  <span className="text-slate-500 block text-xs">Invoice Amount</span>
                  <span className="font-medium text-slate-900">
                    PKR {po.invoice.invoiceAmount.toLocaleString()}
                  </span>
                </div>
              )}
              {po.invoice.notes && (
                <div>
                  <span className="text-slate-500 block text-xs">Invoice Notes</span>
                  <p className="text-slate-700 whitespace-pre-wrap">{po.invoice.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center text-sm text-slate-500">
              No invoice has been associated with this purchase order yet.
            </div>
          )}
        </div>
      </div>

      {/* Planned Payment Schedule Table */}
      {po.paymentSchedule.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-800 text-sm">
            Payment Schedule
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Instalment #</th>
                <th className="px-4 py-2.5">Due Date</th>
                <th className="px-4 py-2.5 text-right">Planned Amount</th>
                <th className="px-4 py-2.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {po.paymentSchedule.map((entry) => (
                <tr key={entry.entryNo}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">#{entry.entryNo}</td>
                  <td className="px-4 py-2.5 text-slate-700">{formatDateOnly(entry.dueDate)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                    PKR {entry.plannedAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{entry.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Item Lines Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-800 text-sm flex justify-between items-center">
          <span>Items Ordered ({po.lineCount})</span>
          <span className="text-xs text-slate-500 font-normal">
            Total quantity:{' '}
            <strong className="text-slate-900">{po.totalQuantity.toLocaleString()}</strong> pcs
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Line</th>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Linked Demand</th>
                <th className="px-4 py-2.5 text-right">Ordered</th>
                <th className="px-4 py-2.5 text-right">Received</th>
                <th className="px-4 py-2.5 text-right">Remaining</th>
                <th className="px-4 py-2.5 text-right">Unit Price</th>
                <th className="px-4 py-2.5 text-right">Line Total</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {po.lines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">#{line.lineNo}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {line.item.name}
                    {!line.item.active && (
                      <span className="ml-1 text-xs text-amber-700">(inactive)</span>
                    )}
                    {line.notes && <div className="text-xs text-slate-500">{line.notes}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {line.demand ? (
                      <Link
                        to={`/demands/${line.demand.id}`}
                        className="text-emerald-800 hover:underline"
                      >
                        {line.demand.code}
                        {line.demand.lineNo ? ` (L#${line.demand.lineNo})` : ''}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {line.quantityOrdered.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {line.quantityReceived.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {line.quantityRemaining.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    PKR {line.unitPrice.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    PKR {line.lineTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      tone={
                        line.completion === 'COMPLETE'
                          ? 'green'
                          : line.completion === 'PARTIAL'
                            ? 'amber'
                            : 'grey'
                      }
                    >
                      {PO_COMPLETION_LABELS[line.completion]}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold text-slate-900">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right">
                  Total:
                </td>
                <td className="px-4 py-3 text-right">{po.totalQuantity.toLocaleString()} pcs</td>
                <td className="px-4 py-3 text-right">0 pcs</td>
                <td className="px-4 py-3 text-right">{po.totalQuantity.toLocaleString()} pcs</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">PKR {po.totalAmount.toLocaleString()}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl space-y-4">
            <h2 id="cancel-modal-title" className="text-lg font-bold text-slate-900">
              Cancel Purchase Order
            </h2>
            <p className="text-sm text-slate-600">
              Cancelling <strong className="text-slate-900">{po.poNumber}</strong> will archive it
              and mark it read-only. Please provide a required reason for the audit trail.
            </p>

            {cancelError && <Notice kind="error">{cancelError}</Notice>}

            <form onSubmit={onCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Reason for cancellation <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className={`${inputClass()} mt-1`}
                  placeholder="Explain why this purchase order is being cancelled..."
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setShowCancelModal(false)}
                  className={secondaryButton}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
