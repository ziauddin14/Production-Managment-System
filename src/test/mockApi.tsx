import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { App } from '../App';
import type { SessionResponse } from '../contracts/auth';
import type { DashboardSummary } from '../contracts/dashboard';

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details: Array<{ path: string; message: string }> = [],
): Response {
  return json(status, { error: { code, message, details } });
}

/**
 * A response that the test releases later. The promise exists before rendering, so resolving it
 * works even if the app has not sent its request yet (avoids a race on slow machines).
 */
export function deferred(): { promise: Promise<Response>; resolve: (r: Response) => void } {
  let resolve: (r: Response) => void = () => undefined;
  const promise = new Promise<Response>((r) => (resolve = r));
  return { promise, resolve };
}

type Handler = (init: RequestInit | undefined, url: URL) => Response | Promise<Response>;

export interface RecordedCall {
  method: string;
  path: string;
  /** Query parameters of the request. */
  search: URLSearchParams;
  init: RequestInit | undefined;
}

/** Stubs `fetch` with handlers keyed by "METHOD /path". Unknown routes return 404. */
export function mockApi(routes: Record<string, Handler | Response>) {
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    calls.push({ method, path: url.pathname, search: url.searchParams, init });
    const route = routes[`${method} ${url.pathname}`];
    if (!route) return apiError(404, 'NOT_FOUND', 'Route not found');
    return typeof route === 'function' ? route(init, url) : route.clone();
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}

// ---- Synthetic fixtures (no real people or data) ----
export const operatorSession: SessionResponse = {
  user: {
    id: '0123456789abcdef01234567',
    code: 'USR-000001',
    username: 'synthetic.operator',
    displayName: 'Synthetic Operator',
    role: 'OPERATOR',
  },
  csrfToken: 'synthetic-csrf-token-0123456789abcdefghijk',
  expiresAt: '2030-01-01T12:00:00.000Z',
  idleExpiresAt: '2030-01-01T08:00:00.000Z',
};

export const viewerSession: SessionResponse = {
  ...operatorSession,
  user: {
    ...operatorSession.user,
    code: 'USR-000002',
    username: 'synthetic.viewer',
    displayName: 'Synthetic Viewer',
    role: 'VIEWER',
  },
};

export function summaryFor(
  session: SessionResponse,
  overrides: Partial<DashboardSummary> = {},
): DashboardSummary {
  return {
    generatedAt: '2030-01-01T07:00:00.000Z',
    user: session.user,
    indicators: [
      {
        key: 'openDemands',
        label: 'Open demands',
        description: 'Demand lines not yet fully dispatched',
        status: 'not_available',
        value: null,
        plannedMilestone: 'M5 Demand Management',
      },
      {
        key: 'activePurchaseOrders',
        label: 'Active purchase orders',
        description: 'Purchase orders not yet quantity-complete',
        status: 'not_available',
        value: null,
        plannedMilestone: 'M6 PO & Vendor Management',
      },
    ],
    system: { database: 'up' },
    ...overrides,
  };
}

export const healthOk = json(200, {
  status: 'ok',
  service: 'mab-pms-api',
  time: '2030-01-01T00:00:00.000Z',
});

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
