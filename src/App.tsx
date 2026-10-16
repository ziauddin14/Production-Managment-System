import { useEffect, useState } from 'react';
import { fetchHealth } from './api';

type ApiStatus = 'checking' | 'online' | 'offline';

/** M2 placeholder shell. Business screens arrive from M3 onwards. */
export function App() {
  const [status, setStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal)
      .then(() => setStatus('online'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('offline');
      });
    return () => controller.abort();
  }, []);

  const label = { checking: 'Checking…', online: 'Online', offline: 'Unavailable' }[status];
  const colour = {
    checking: 'bg-slate-200 text-slate-700',
    online: 'bg-emerald-100 text-emerald-800',
    offline: 'bg-amber-100 text-amber-800',
  }[status];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
      <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">MAB Production Management System</h1>
        <p className="mt-2 text-sm text-slate-600">
          Project foundation (M2). Application features are not available yet.
        </p>
        <div className="mt-6 flex items-center gap-3 text-sm">
          <span className="text-slate-600">API status</span>
          <span className={`rounded px-2 py-0.5 font-medium ${colour}`} data-testid="api-status">
            {label}
          </span>
        </div>
      </div>
    </main>
  );
}
