import { Loader2 } from 'lucide-react';

export function FullPageLoader({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-700" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </div>
  );
}
