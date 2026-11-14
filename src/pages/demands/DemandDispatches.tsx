import { Link } from 'react-router';
import { listDispatches } from '../../api';
import { formatDateOnly, linkClass, LoadingRows, RecordStatusBadge } from '../../components/ui';
import { useResource } from '../../hooks/useResource';

/** Dispatches recorded against one demand (active and cancelled). */
export function DemandDispatches({ demandId }: { demandId: string }) {
  const dispatches = useResource(
    `demand-dispatches:${demandId}`,
    (signal) => listDispatches({ demandId, status: 'all', pageSize: 100 }, signal),
    'Dispatches could not be loaded.',
  );
  return (
    <section aria-labelledby="demand-dispatches-heading" className="space-y-3">
      <h2 id="demand-dispatches-heading" className="text-base font-semibold text-slate-900">
        Dispatches
      </h2>
      {dispatches.loading && <LoadingRows label="Loading dispatches" rows={2} />}
      {dispatches.error && (
        <p className="text-sm text-red-700" role="alert">
          {dispatches.error}
        </p>
      )}
      {dispatches.data && dispatches.data.items.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          Nothing has been dispatched against this demand yet.
        </p>
      )}
      {dispatches.data && dispatches.data.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <caption className="sr-only">Dispatches for this demand</caption>
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5">
                  Dispatch
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Date
                </th>
                <th scope="col" className="px-4 py-2.5">
                  To division
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Bilty no.
                </th>
                <th scope="col" className="px-4 py-2.5 text-right">
                  Quantity
                </th>
                <th scope="col" className="px-4 py-2.5">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {dispatches.data.items.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5">
                    <Link to={`/dispatches/${d.id}`} className={linkClass}>
                      {d.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {formatDateOnly(d.dispatchDate)}
                  </td>
                  <td className="px-4 py-2.5">{d.destinationDivision.name}</td>
                  <td className="px-4 py-2.5">{d.biltyNo ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {d.totalQuantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <RecordStatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
