import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">The page you opened does not exist.</p>
      <Link
        to="/"
        className="mt-4 inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
