import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { ApiError, createPayment, getPurchaseOrder } from '../../api';
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
  formatMoney,
  inputClass,
  LoadingRows,
  Notice,
  primaryButton,
  secondaryButton,
  StatusBadge,
} from '../../components/ui';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  paymentMethods,
  type PaymentMethod,
  type PaymentPayload,
} from '../../contracts/operations';
import { todayInKarachi, type PurchaseOrderDetail } from '../../contracts/purchaseOrders';
import { useResource } from '../../hooks/useResource';

const cents = (value: number) => Math.round(value * 100);

export function PaymentFormPage() {
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
        <h1 className="text-2xl font-semibold text-slate-900">New payment</h1>
        <Notice kind="error">Only the Production Operator can record vendor payments.</Notice>
        <BackLink to="/payments">All payments</BackLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink to="/payments">All payments</BackLink>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New payment</h1>
        <p className="mt-1 text-sm text-slate-600">
          Record a payment made to a vendor against an open purchase order.
        </p>
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
        <label htmlFor="payment-po" className="block text-sm font-medium text-slate-700">
          Purchase order
        </label>
        <PurchaseOrderPicker
          id="payment-po"
          value={poId}
          onChange={setPoId}
          eligible={(o) => o.outstandingAmount > 0}
          emptyHint="No open purchase orders have an outstanding amount."
        />
      </section>
      {po.loading && <LoadingRows label="Loading purchase order" rows={4} />}
      {po.error && <ErrorPanel message={po.error} onRetry={po.notFound ? undefined : po.reload} />}
      {po.data && po.data.status === 'CANCELLED' && (
        <Notice kind="error">This purchase order is cancelled. Payments cannot be recorded.</Notice>
      )}
      {po.data && po.data.status === 'OPEN' && (
        <PaymentForm key={po.data.id} po={po.data} csrfToken={session.csrfToken} />
      )}
    </div>
  );
}

function PaymentForm({ po, csrfToken }: { po: PurchaseOrderDetail; csrfToken: string }) {
  const { handleApiError } = useAuth();
  const navigate = useNavigate();
  const today = todayInKarachi();
  const [paymentDate, setPaymentDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [scheduleEntryNo, setScheduleEntryNo] = useState('');
  const [notes, setNotes] = useState('');
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const fullyPaid = po.outstandingAmount <= 0;

  const showError = (message: string) => {
    setSubmitError(message);
    errorRef.current?.focus();
  };

  const onScheduleChange = (value: string) => {
    setScheduleEntryNo(value);
    const entry = po.paymentSchedule.find((s) => String(s.entryNo) === value);
    if (entry && !amount.trim()) {
      const suggested = Math.min(entry.plannedAmount, po.outstandingAmount);
      if (suggested > 0) setAmount(String(suggested));
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!paymentDate) next.paymentDate = 'Payment date is required';
    else if (paymentDate > today) next.paymentDate = 'Payment date cannot be in the future';
    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      next.amount = 'Enter an amount greater than 0';
    } else if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      next.amount = 'Amount may have at most 2 decimals';
    } else if (cents(value) > cents(po.outstandingAmount)) {
      next.amount = `Amount cannot exceed the outstanding ${formatMoney(po.outstandingAmount)}`;
    }
    validateDocuments(documents, next);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      showError('Please fix the errors below.');
      return;
    }

    const payload: PaymentPayload = {
      purchaseOrderId: po.id,
      paymentDate,
      amount: value,
      method,
      reference: reference.trim() || null,
      scheduleEntryNo: scheduleEntryNo ? Number(scheduleEntryNo) : null,
      notes: notes.trim() || null,
      documents: documentsPayload(documents),
    };
    setSaving(true);
    setSubmitError(null);
    try {
      const created = await createPayment(payload, csrfToken);
      navigate(`/payments/${created.id}`, {
        state: { notice: `Payment ${created.code} recorded.` },
      });
    } catch (err) {
      if (handleApiError(err)) return;
      if (err instanceof ApiError && err.details.length > 0) {
        setErrors(detailsToFieldErrors(err));
        showError(err.message || 'The server rejected some entries. Check the highlighted fields.');
      } else {
        showError(err instanceof ApiError ? err.message : 'The payment could not be saved.');
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

      <section
        aria-label="Purchase order balance"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">
            {po.poNumber} · {po.vendor.name}
          </h2>
          <StatusBadge
            tone={
              po.paymentStatus === 'PAID'
                ? 'green'
                : po.paymentStatus === 'PARTIAL'
                  ? 'amber'
                  : 'grey'
            }
          >
            {PAYMENT_STATUS_LABELS[po.paymentStatus]}
          </StatusBadge>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">Approved amount</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900">
              {formatMoney(po.approvedAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Paid so far</dt>
            <dd className="mt-1 font-semibold tabular-nums text-slate-900">
              {formatMoney(po.paidAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Outstanding</dt>
            <dd className="mt-1 font-semibold tabular-nums text-amber-800">
              {formatMoney(po.outstandingAmount)}
            </dd>
          </div>
        </dl>
      </section>

      {fullyPaid ? (
        <Notice kind="success">This purchase order is fully paid. Nothing is outstanding.</Notice>
      ) : (
        <>
          <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-900">
              Payment details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="payment-date" className="block text-sm font-medium text-slate-700">
                  Payment date
                </label>
                <input
                  id="payment-date"
                  type="date"
                  value={paymentDate}
                  max={today}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  aria-invalid={Boolean(errors.paymentDate)}
                  aria-describedby={describe('paymentDate', 'payment-date-error')}
                  className={`${inputClass(Boolean(errors.paymentDate))} mt-1`}
                />
                <FieldError id="payment-date-error" message={errors.paymentDate} />
              </div>
              {po.paymentSchedule.length > 0 && (
                <div>
                  <label
                    htmlFor="payment-schedule"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Planned instalment (optional)
                  </label>
                  <select
                    id="payment-schedule"
                    value={scheduleEntryNo}
                    onChange={(e) => onScheduleChange(e.target.value)}
                    aria-invalid={Boolean(errors.scheduleEntryNo)}
                    aria-describedby={describe('scheduleEntryNo', 'payment-schedule-error')}
                    className={`${inputClass(Boolean(errors.scheduleEntryNo))} mt-1`}
                  >
                    <option value="">Not linked to an instalment</option>
                    {po.paymentSchedule.map((s) => (
                      <option key={s.entryNo} value={s.entryNo}>
                        #{s.entryNo} · due {formatDateOnly(s.dueDate)} ·{' '}
                        {formatMoney(s.plannedAmount)}
                        {s.note ? ` · ${s.note}` : ''}
                      </option>
                    ))}
                  </select>
                  <FieldError id="payment-schedule-error" message={errors.scheduleEntryNo} />
                </div>
              )}
              <div>
                <label
                  htmlFor="payment-amount"
                  className="block text-sm font-medium text-slate-700"
                >
                  Amount (PKR)
                </label>
                <input
                  id="payment-amount"
                  type="number"
                  min={0.01}
                  max={po.outstandingAmount}
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={describe('amount', 'payment-amount-error')}
                  className={`${inputClass(Boolean(errors.amount))} mt-1`}
                />
                <FieldError id="payment-amount-error" message={errors.amount} />
              </div>
              <div>
                <label
                  htmlFor="payment-method"
                  className="block text-sm font-medium text-slate-700"
                >
                  Method
                </label>
                <select
                  id="payment-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className={`${inputClass()} mt-1`}
                >
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="payment-reference"
                  className="block text-sm font-medium text-slate-700"
                >
                  Reference (cheque / transaction no.)
                </label>
                <input
                  id="payment-reference"
                  type="text"
                  maxLength={100}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  aria-invalid={Boolean(errors.reference)}
                  aria-describedby={describe('reference', 'payment-reference-error')}
                  className={`${inputClass(Boolean(errors.reference))} mt-1`}
                />
                <FieldError id="payment-reference-error" message={errors.reference} />
              </div>
            </div>
            <div>
              <label htmlFor="payment-notes" className="block text-sm font-medium text-slate-700">
                Notes
              </label>
              <textarea
                id="payment-notes"
                rows={2}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                aria-invalid={Boolean(errors.notes)}
                aria-describedby={describe('notes', 'payment-notes-error')}
                className={`${inputClass(Boolean(errors.notes))} mt-1`}
              />
              <FieldError id="payment-notes-error" message={errors.notes} />
            </div>
            <DocumentsEditor rows={documents} onChange={setDocuments} errors={errors} />
          </section>

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => navigate('/payments')} className={secondaryButton}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={primaryButton}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Record payment'}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
