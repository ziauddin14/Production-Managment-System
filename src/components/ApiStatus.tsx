import { useEffect, useState } from 'react';
import { fetchHealth } from '../api';

type ApiStatusValue = 'checking' | 'online' | 'offline';

const LABELS: Record<ApiStatusValue, string> = {
  checking: 'Checking…',
  online: 'Online',
  offline: 'Unavailable',
};

const STYLES: Record<ApiStatusValue, string> = {
  checking: 'bg-slate-100 text-slate-700 ring-slate-200',
  online: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  offline: 'bg-amber-50 text-amber-800 ring-amber-200',
};

/** Shows whether the PMS API answers its public health check. */
export function ApiStatus() {
  const [status, setStatus] = useState<ApiStatusValue>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then(() => setStatus('online'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-slate-600">PMS server</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
        data-testid="api-status"
      >
        {LABELS[status]}
      </span>
    </span>
  );
}
