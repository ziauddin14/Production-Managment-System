import { Link, useParams } from 'react-router';
import { Info } from 'lucide-react';
import { PLANNED_MODULES } from '../navigation';
import { NotFoundPage } from './NotFoundPage';

/** Explains a module that is planned but not built yet. It has no working functions. */
export function ModulePlaceholderPage() {
  const { moduleKey } = useParams();
  const module = PLANNED_MODULES.find((m) => m.key === moduleKey);
  if (!module) return <NotFoundPage />;
  const Icon = module.icon;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">{module.label}</h1>
      </header>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
          <div className="space-y-2 text-sm text-slate-700">
            <p className="font-medium text-slate-900">Not available yet</p>
            <p>{module.description}</p>
            <p>
              This module is planned for milestone <strong>{module.plannedMilestone}</strong>.
              Nothing on this page records or changes data.
            </p>
          </div>
        </div>
      </div>
      <Link
        to="/"
        className="inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
