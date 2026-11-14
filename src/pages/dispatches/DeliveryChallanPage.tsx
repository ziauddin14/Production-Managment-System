import { useParams } from 'react-router';
import { Printer } from 'lucide-react';
import { getDispatch } from '../../api';
import {
  BackLink,
  ErrorPanel,
  formatDateOnly,
  LoadingRows,
  primaryButton,
} from '../../components/ui';
import { LOCATION_KIND_LABELS } from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';

/** Printable delivery challan for one dispatch. The app chrome is hidden when printing. */
export function DeliveryChallanPage() {
  const { id = '' } = useParams();
  const dispatch = useResource(
    `dispatch:${id}`,
    (signal) => getDispatch(id, signal),
    'The dispatch could not be loaded.',
  );
  const d = dispatch.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink to={`/dispatches/${id}`}>Back to dispatch</BackLink>
        {d && (
          <button type="button" onClick={() => window.print()} className={primaryButton}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print
          </button>
        )}
      </div>
      {dispatch.loading && <LoadingRows label="Loading delivery challan" rows={6} />}
      {dispatch.error && (
        <ErrorPanel
          message={dispatch.error}
          onRetry={dispatch.notFound ? undefined : dispatch.reload}
        />
      )}
      {d && (
        <article
          aria-labelledby="challan-title"
          className="challan mx-auto max-w-4xl space-y-6 rounded-lg border border-slate-300 bg-white p-6 text-slate-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <header className="flex flex-col gap-2 border-b-2 border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                MAB Production Management System
              </p>
              <h1 id="challan-title" className="text-2xl font-bold">
                Delivery Challan
              </h1>
            </div>
            <div className="text-sm sm:text-right">
              <p>
                Challan / dispatch no. <strong className="font-mono">{d.code}</strong>
              </p>
              <p>
                Date: <strong>{formatDateOnly(d.dispatchDate)}</strong>
              </p>
            </div>
          </header>

          {d.status === 'CANCELLED' && (
            <p
              className="rounded border-2 border-red-700 px-3 py-2 text-center text-lg font-bold uppercase tracking-widest text-red-700"
              role="note"
            >
              Cancelled — not valid for delivery
            </p>
          )}

          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-500">From</dt>
              <dd className="font-medium">
                {d.source.name} ({LOCATION_KIND_LABELS[d.source.kind]})
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">To</dt>
              <dd className="font-medium">
                {d.destinationDivision.name}
                {d.destinationDivision.provinceName && `, ${d.destinationDivision.provinceName}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Demand</dt>
              <dd className="font-medium">{d.demand?.code ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Bilty no.</dt>
              <dd className="font-medium">{d.biltyNo ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Transporter</dt>
              <dd className="font-medium">{d.transporterName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Vehicle no.</dt>
              <dd className="font-medium">{d.vehicleNo ?? '—'}</dd>
            </div>
          </dl>

          <div className="overflow-x-auto">
            <table className="min-w-full border border-slate-400 text-left text-sm">
              <caption className="sr-only">Goods dispatched</caption>
              <thead className="bg-slate-100 text-xs uppercase">
                <tr>
                  <th scope="col" className="border border-slate-400 px-3 py-2">
                    #
                  </th>
                  <th scope="col" className="border border-slate-400 px-3 py-2">
                    Item
                  </th>
                  <th scope="col" className="border border-slate-400 px-3 py-2">
                    PO number / lot
                  </th>
                  <th scope="col" className="border border-slate-400 px-3 py-2 text-right">
                    Quantity
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="border border-slate-400 px-3 py-2 tabular-nums">
                      {line.lineNo}
                    </td>
                    <td className="border border-slate-400 px-3 py-2">
                      {line.item.name}
                      <span className="block text-xs text-slate-500">{line.item.code}</span>
                    </td>
                    <td className="border border-slate-400 px-3 py-2">
                      {line.lot.poNumber}
                      <span className="block text-xs text-slate-500">
                        {line.lot.purchaseOrderCode} · line {line.lot.poLineNo}
                      </span>
                    </td>
                    <td className="border border-slate-400 px-3 py-2 text-right tabular-nums">
                      {line.quantity.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3} className="border border-slate-400 px-3 py-2 text-right">
                    Total quantity
                  </td>
                  <td className="border border-slate-400 px-3 py-2 text-right tabular-nums">
                    {d.totalQuantity.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {d.notes && (
            <p className="text-sm">
              <span className="font-medium">Notes: </span>
              {d.notes}
            </p>
          )}

          <div className="grid grid-cols-1 gap-6 pt-10 text-sm sm:grid-cols-3">
            {['Dispatched by', 'Transporter / driver', 'Received by (division)'].map((label) => (
              <div key={label} className="space-y-1">
                <div className="h-16 border-b border-slate-700" aria-hidden="true" />
                <p className="font-medium">{label}</p>
                <p className="text-xs text-slate-500">Name, signature, date and stamp</p>
              </div>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}
