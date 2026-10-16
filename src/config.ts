/**
 * Frontend configuration. Only public values belong here: anything prefixed VITE_ is bundled into
 * the browser code. Never put secrets in VITE_ variables.
 */
export function apiBaseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  return typeof value === 'string' && value.length > 0
    ? value.replace(/\/+$/, '')
    : 'http://127.0.0.1:4000';
}
