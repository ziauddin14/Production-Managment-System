import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Ban, Loader2, Pencil, Printer } from 'lucide-react';
import { ApiError, cancelDispatch, getDispatch, updateDispatch } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  DocumentList,
  DocumentsEditor,
  documentsPayload,
  newDocumentRow,
  validateDocuments,
  type DocumentRow,
} from '../../components/Documents';
import {
  BackLink,
  CancelReasonDialog,
  dangerButton,
  detailsToFieldErrors,
  ErrorPanel,
  Field,
  formatDateOnly,
  formatDateTime,
  formatMoney,
  linkClass,
  LoadingRows,
  Notice,
  primaryButton,
  RecordStatusBadge,
  secondaryButton,
} from '../../components/ui';
import { LOCATION_KIND_LABELS, type DispatchDetail } from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';
import { TransportFields } from './TransportFields';

export function DispatchDetailPage() {
  const { id = '' } = useParams();
  const { session, handleApiError } = useAuth();
  const location = useLocation();
  const flash = (location.state as { notice?: string } | null)?.notice ?? null;
  const canWrite = session?.user.role === 'OPERATOR';
  const dispatch = useResource(
    `dispatch:${id}`,
    (signal) => getDispatch(id, signal),
    'The dispatch could not be loaded.',
  );
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const d = dispatch.data;

  return (
    <div className="space-y-6">
      <BackLink to="/dispatches">All dispatches</BackLink>
      {dispatch.loading && <LoadingRows label="Loading dispatch" rows={6} />}
      {dispatch.error && (
        <ErrorPanel
          message={dispatch.error}
          onRetry={dispatch.notFound ? undefined : dispatch.reload}
        />
      )}
      {d && (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">{d.code}</h1>
              <RecordStatusBadge status={d.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/dispatches/${d.id}/challan`} className={secondaryButton}>
                <Printer className="h-4 w-4" aria-hidden="true" />
                Delivery challan
              </Link>
              {canWrite && d.status === 'ACTIVE' && !editing && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setEditing(true);
                    }}
                    className={secondaryButton}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit Bilty &amp; transport
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setCancelOpen(true);
                    }}
                    className={dangerButton}
                  >
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    Cancel dispatch
                  </button>
                </>
              )}
            </div>
          </header>

          {flash && !notice && <Notice kind="success">{flash}</Notice>}
          {notice && <Notice kind="success">{notice}</Notice>}
          {d.cancellation && (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
              role="note"
            >
              Cancelled {formatDateTime(d.cancellation.at)}
              {d.cancellation.by && ` by ${d.cancellation.by}`}. Reason: {d.cancellation.reason}
            </div>
          )}

          {editing && session ? (
            <TransportEditor
              dispatch={d}
              csrfToken={session.csrfToken}
              onClose={() => setEditing(false)}
              onSaved={(updated) => {
                dispatch.setData(updated);
                setEditing(false);
                setNotice('Bilty and transport details saved.');
              }}
            />
          ) : (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Details</h2>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Dispatch date">{formatDateOnly(d.dispatchDate)}</Field>
                <Field label="From">
                  {d.source.name}
                  <span className="block text-xs font-normal text-slate-500">
                    {LOCATION_KIND_LABELS[d.source.kind]}
                  </span>
                </Field>
                <Field label="To division">
                  {d.destinationDivision.name}
                  {d.destinationDivision.provinceName && (
                    <span className="block text-xs font-normal text-slate-500">
                      {d.destinationDivision.provinceName}
                    </span>
                  )}
                </Field>
                <Field label="Demand">
                  {d.demand ? (
                    <Link to={`/demands/${d.demand.id}`} className={linkClass}>
                      {d.demand.code}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Field>
                <Field label="Bilty no.">{d.biltyNo ?? '—'}</Field>
                <Field label="Transporter">{d.transporterName ?? '—'}</Field>
                <Field label="Vehicle no.">{d.vehicleNo ?? '—'}</Field>
                <Field label="Freight">
                  {d.freightAmount === null ? '—' : formatMoney(d.freightAmount)}
                </Field>
                <Field label="Recorded">
                  {formatDateTime(d.createdAt)}
                  {d.createdBy && ` by ${d.createdBy}`}
                </Field>
                {d.notes && <Field label="Notes">{d.notes}</Field>}
              </dl>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-slate-500">Supporting documents</h3>
                <div className="mt-1">
                  <DocumentList documents={d.documents} />
                </div>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Items ({d.lineCount}) · {d.totalQuantity.toLocaleString()} units
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <caption className="sr-only">Dispatch lines</caption>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      #
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Item
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Lot (PO / line)
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Demand line
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Quantity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {d.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 tabular-nums text-slate-500">{line.lineNo}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{line.item.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/purchase-orders/${line.lot.purchaseOrderId}`}
                          className={linkClass}
                        >
                          {line.lot.poNumber}
                        </Link>
                        <span className="text-xs text-slate-500"> · line {line.lot.poLineNo}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {line.demandLine ? (
                          <Link to={`/demands/${line.demandLine.demandId}`} className={linkClass}>
                            {line.demandLine.demandCode} · line {line.demandLine.lineNo}
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {line.quantity.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {cancelOpen && session && (
            <CancelReasonDialog
              title={`Cancel ${d.code}?`}
              description="The dispatch is kept for the record. Its quantities return to stock at the source and any linked demand lines are no longer counted as delivered."
              keepLabel="Keep dispatch"
              confirmLabel="Cancel dispatch"
              onClose={() => setCancelOpen(false)}
              onApiError={handleApiError}
              onConfirm={async (reason) => {
                const updated = await cancelDispatch(
                  d.id,
                  { rev: d.rev, reason },
                  session.csrfToken,
                );
                setCancelOpen(false);
                dispatch.setData(updated);
                setNotice(`Dispatch ${updated.code} was cancelled.`);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function TransportEditor({
  dispatch,
  csrfToken,
  onClose,
  onSaved,
}: {
  dispatch: DispatchDetail;
  csrfToken: string;
  onClose(): void;
  onSaved(updated: DispatchDetail): void;
}) {
  const { handleApiError } = useAuth();
  const [biltyNo, setBiltyNo] = useState(dispatch.biltyNo ?? '');
  const [transporterName, setTransporterName] = useState(dispatch.transporterName ?? '');
  const [vehicleNo, setVehicleNo] = useState(dispatch.vehicleNo ?? '');
  const [freightAmount, setFreightAmount] = useState(
    dispatch.freightAmount === null ? '' : String(dispatch.freightAmount),
  );
  const [notes, setNotes] = useState(dispatch.notes ?? '');
  const [documents, setDocuments] = useState<DocumentRow[]>(() =>
    dispatch.documents.map((doc) => newDocumentRow(doc)),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    let freight: number | null = null;
    if (freightAmount.trim()) {
      freight = Number(freightAmount);
      if (!Number.isFinite(freight) || freight < 0)
        next.freightAmount = 'Freight must be 0 or more';
    }
    validateDocuments(documents, next);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setSubmitError('Please fix the errors below.');
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      onSaved(
        await updateDispatch(
          dispatch.id,
          {
            rev: dispatch.rev,
            biltyNo: biltyNo.trim() || null,
            transporterName: transporterName.trim() || null,
            vehicleNo: vehicleNo.trim() || null,
            freightAmount: freight,
            notes: notes.trim() || null,
            documents: documentsPayload(documents),
          },
          csrfToken,
        ),
      );
    } catch (err) {
      if (handleApiError(err)) return;
      if (err instanceof ApiError && err.status === 409) {
        setSubmitError('This dispatch was changed by someone else. Reload the page and try again.');
      } else if (err instanceof ApiError && err.details.length > 0) {
        setErrors(detailsToFieldErrors(err));
        setSubmitError(err.message);
      } else {
        setSubmitError(err instanceof ApiError ? err.message : 'The changes could not be saved.');
      }
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="transport-heading"
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 id="transport-heading" className="text-base font-semibold text-slate-900">
        Edit Bilty &amp; transport
      </h2>
      {submitError && <Notice kind="error">{submitError}</Notice>}
      <TransportFields
        values={{ biltyNo, transporterName, vehicleNo, freightAmount, notes }}
        setters={{ setBiltyNo, setTransporterName, setVehicleNo, setFreightAmount, setNotes }}
        errors={errors}
      />
      <DocumentsEditor rows={documents} onChange={setDocuments} errors={errors} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} disabled={saving} className={secondaryButton}>
          Discard changes
        </button>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  );
}
