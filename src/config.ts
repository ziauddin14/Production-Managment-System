/**
 * Frontend configuration. Only public values belong here: anything prefixed VITE_ is bundled into
 * the browser code. Never put secrets in VITE_ variables.
 */
export function apiBaseUrl(): string {
  return resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
}

/**
 * `/` means "same origin": the API is reached through this site's own `/api` path (a Vercel
 * rewrite to the backend), which keeps the session cookie first-party in every browser.
 */
export function resolveApiBaseUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return 'http://127.0.0.1:4000';
  if (value === '/') return '';
  return value.replace(/\/+$/, '');
}
