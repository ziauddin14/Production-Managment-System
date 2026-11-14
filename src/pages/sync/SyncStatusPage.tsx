import { useState } from 'react';
import { Info, Loader2, RotateCcw } from 'lucide-react';
import { ApiError, getSyncSummary, listSyncJobs, retrySyncJob } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  EmptyState,
  ErrorPanel,
  formatDateTime,
  inputClass,
  LoadingRows,
  Notice,
  Pagination,
  secondaryButton,
  StatusBadge,
} from '../../components/ui';
import {
  SYNC_STATUS_LABELS,
  syncJobStatuses,
  type SyncJob,
  type SyncJobStatus,
} from '../../contracts/operations';
import { useResource } from '../../hooks/useResource';

const PAGE_SIZE = 25;

const STATUS_TONES: Record<SyncJobStatus, 'green' | 'grey' | 'amber' | 'red'> = {
  PENDING: 'grey',
  LEASED: 'grey',
  DONE: 'green',
  RETRY: 'amber',
  CONFLICT: 'red',
  FAILED: 'red',
};

const retryable = (job: SyncJob) => job.status === 'FAILED' || job.status === 'CONFLICT';

export function SyncStatusPage() {
  const { session, handleApiError } = useAuth();
  const canWrite = session?.user.role === 'OPERATOR';
  const [status, setStatus] = useState<SyncJobStatus | ''>('');
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const summary = useResource(
    'sync-summary',
    (signal) => getSyncSummary(signal),
    'The sync summary could not be loaded.',
  );
  const params = { status: status || undefined, page, pageSize: PAGE_SIZE };
  const jobs = useResource(
    JSON.stringify(params),
    (signal) => listSyncJobs(params, signal),
    'Sync jobs could not be loaded.',
  );

  const retry = async (job: SyncJob) => {
    if (!session) return;
    setRetrying(job.id);
    setNotice(null);
    try {
      const updated = await retrySyncJob(job.id, session.csrfToken);
      if (jobs.data) {
        jobs.setData({
          ...jobs.data,
          items: jobs.data.items.map((j) => (j.id === updated.id ? updated : j)),
        });
      }
      summary.reload();
      setNotice({ kind: 'success', text: `Job for ${job.entity.code} was queued again.` });
    } catch (err) {
      if (handleApiError(err)) return;
      setNotice({
        kind: 'error',
        text: err instanceof ApiError ? err.message : 'The job could not be queued again.',
      });
    } finally {
      setRetrying(null);
    }
  };

  const s = summary.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Excel sync</h1>
        <p className="mt-1 text-sm text-slate-600">
          Every change in PMS queues a job to update the matching Excel workbook. This page shows
          the queue; it does not edit workbooks itself.
        </p>
      </div>

      {summary.loading && <LoadingRows label="Loading sync summary" rows={3} />}
      {summary.error && <ErrorPanel message={summary.error} onRetry={summary.reload} />}
      {s && (
        <>
          <div
            role="note"
            className={[
              'flex gap-3 rounded-lg border px-4 py-3 text-sm',
              s.processorEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-300 bg-amber-50 text-amber-900',
            ].join(' ')}
          >
            <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">
                {s.processorEnabled
                  ? 'Workbook processor is running'
                  : 'Workbook processor is not enabled'}
              </p>
              <p className="mt-1">{s.processorNote}</p>
            </div>
          </div>

          <section aria-labelledby="sync-status-heading" className="space-y-3">
            <h2 id="sync-status-heading" className="text-base font-semibold text-slate-900">
              Jobs by status
            </h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {syncJobStatuses.map((st) => (
                <div key={st} className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
                  <dt className="text-xs font-medium text-slate-500">{SYNC_STATUS_LABELS[st]}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
                    {(s.byStatus.find((b) => b.status === st)?.count ?? 0).toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-slate-500">
              Oldest pending job:{' '}
              {s.oldestPendingAt ? formatDateTime(s.oldestPendingAt) : 'none waiting'}
            </p>
          </section>

          {s.byTarget.length > 0 && (
            <section aria-labelledby="sync-target-heading" className="space-y-3">
              <h2 id="sync-target-heading" className="text-base font-semibold text-slate-900">
                By workbook
              </h2>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <caption className="sr-only">Sync jobs by workbook and sheet</caption>
                  <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">
                        Workbook
                      </th>
                      <th scope="col" className="px-4 py-2.5">
                        Sheet
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right">
                        Pending
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right">
                        Failed
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right">
                        Conflict
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-right">
                        Done
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {s.byTarget.map((t) => (
                      <tr key={`${t.workbook}:${t.sheet ?? ''}`}>
                        <td className="px-4 py-2.5 font-medium text-slate-900">{t.workbook}</td>
                        <td className="px-4 py-2.5 text-slate-600">{t.sheet ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{t.pending}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{t.failed}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{t.conflict}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{t.done}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="sync-jobs-heading" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="sync-jobs-heading" className="text-base font-semibold text-slate-900">
            Jobs
          </h2>
          <label className="block text-xs font-medium text-slate-600 sm:w-56">
            Job status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as SyncJobStatus | '');
                setPage(1);
              }}
              className={`${inputClass()} mt-1`}
            >
              <option value="">All statuses</option>
              {syncJobStatuses.map((st) => (
                <option key={st} value={st}>
                  {SYNC_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
        {jobs.loading ? (
          <LoadingRows label="Loading sync jobs" rows={5} />
        ) : jobs.error ? (
          <ErrorPanel message={jobs.error} onRetry={jobs.reload} />
        ) : jobs.data && jobs.data.items.length === 0 ? (
          <EmptyState title="No sync jobs match this filter" />
        ) : jobs.data ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <caption className="sr-only">Sync jobs</caption>
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5">
                      Record
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Target
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Operation
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Attempts
                    </th>
                    <th scope="col" className="px-4 py-2.5">
                      Updated
                    </th>
                    {canWrite && (
                      <th scope="col" className="px-4 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {jobs.data.items.map((job) => (
                    <tr key={job.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-slate-900">
                          {job.entity.code}
                        </div>
                        <div className="text-xs text-slate-500">
                          {job.entity.collection} · rev {job.entityRev}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {job.workbook}
                        {job.sheet && <div className="text-xs text-slate-500">{job.sheet}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{job.operation}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={STATUS_TONES[job.status]}>
                          {SYNC_STATUS_LABELS[job.status]}
                        </StatusBadge>
                        {job.lastError && (
                          <p className="mt-1 max-w-xs text-xs text-red-700">{job.lastError}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{job.attempts}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
                        {formatDateTime(job.updatedAt)}
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          {retryable(job) && (
                            <button
                              type="button"
                              onClick={() => void retry(job)}
                              disabled={retrying !== null}
                              className={`${secondaryButton} px-3 py-1.5`}
                              aria-label={`Retry ${job.entity.code}`}
                            >
                              {retrying === job.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                              )}
                              Retry
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={jobs.data.total}
              noun="jobs"
              onPage={setPage}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}
