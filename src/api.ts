import type { z } from 'zod';
import {
  apiErrorResponseSchema,
  sessionResponseSchema,
  type SessionResponse,
} from './contracts/auth';
import { dashboardSummarySchema, type DashboardSummary } from './contracts/dashboard';
import { healthResponseSchema, type HealthResponse } from './contracts/health';
import {
  masterListResponseSchema,
  masterRecordSchema,
  type MasterEntityKey,
  type MasterListParams,
  type MasterListResponse,
  type MasterRecord,
} from './contracts/masterData';
import {
  demandDetailSchema,
  demandListResponseSchema,
  type DemandDetail,
  type DemandListParams,
  type DemandListResponse,
  type DemandPayload,
} from './contracts/demands';
import { apiBaseUrl } from './config';

/** An error returned by the PMS API, with its machine-readable code and safe message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Array<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isUnauthenticated(): boolean {
    return (
      this.status === 401 && (this.code === 'UNAUTHENTICATED' || this.code === 'SESSION_EXPIRED')
    );
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  csrfToken?: string;
  signal?: AbortSignal;
}

/**
 * Calls the PMS API. The session lives in an HttpOnly cookie, so requests are sent with
 * `credentials: 'include'` and no token is ever stored in JavaScript-accessible storage.
 */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T> | null,
  { method = 'GET', body, csrfToken, signal }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'The PMS server could not be reached. Check your connection and try again.',
    );
  }

  if (!response.ok) {
    const parsed = apiErrorResponseSchema.safeParse(await response.json().catch(() => null));
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(
      response.status,
      'UNKNOWN_ERROR',
      `Unexpected server response (${response.status})`,
    );
  }
  if (response.status === 204 || schema === null) return undefined as T;
  const result = schema.safeParse(await response.json().catch(() => null));
  if (!result.success) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server returned an unexpected response.',
    );
  }
  return result.data;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl()}/api/health`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`API health check failed (${response.status})`);
  return healthResponseSchema.parse(await response.json());
}

export function login(username: string, password: string): Promise<SessionResponse> {
  return apiRequest('/api/auth/login', sessionResponseSchema, {
    method: 'POST',
    body: { username, password },
  });
}

export function getSession(signal?: AbortSignal): Promise<SessionResponse> {
  return apiRequest('/api/auth/session', sessionResponseSchema, { signal });
}

export function logout(csrfToken: string): Promise<void> {
  return apiRequest('/api/auth/logout', null, { method: 'POST', csrfToken });
}

export function getDashboardSummary(signal?: AbortSignal): Promise<DashboardSummary> {
  return apiRequest('/api/dashboard/summary', dashboardSummarySchema, { signal });
}

export function listMasterRecords(
  entity: MasterEntityKey,
  params: MasterListParams,
  signal?: AbortSignal,
): Promise<MasterListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.provinceId) query.set('provinceId', params.provinceId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/api/master/${entity}${suffix}`, masterListResponseSchema, { signal });
}

export function createMasterRecord(
  entity: MasterEntityKey,
  body: { name: string; provinceId?: string },
  csrfToken: string,
): Promise<MasterRecord> {
  return apiRequest(`/api/master/${entity}`, masterRecordSchema, {
    method: 'POST',
    body,
    csrfToken,
  });
}

export function updateMasterRecord(
  entity: MasterEntityKey,
  id: string,
  body: { rev: number; name?: string; provinceId?: string; active?: boolean },
  csrfToken: string,
): Promise<MasterRecord> {
  return apiRequest(`/api/master/${entity}/${id}`, masterRecordSchema, {
    method: 'PATCH',
    body,
    csrfToken,
  });
}

/** Loads every record of a master list (pages of 100), for selection lists in forms. */
export async function listAllMasterRecords(
  entity: MasterEntityKey,
  status: 'active' | 'all' = 'active',
  signal?: AbortSignal,
): Promise<MasterRecord[]> {
  const all: MasterRecord[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const result = await listMasterRecords(entity, { status, page, pageSize: 100 }, signal);
    all.push(...result.items);
    if (all.length >= result.total || result.items.length === 0) break;
  }
  return all;
}

import {
  purchaseOrderDetailSchema,
  purchaseOrderListResponseSchema,
  type PurchaseOrderDetail,
  type PurchaseOrderListParams,
  type PurchaseOrderListResponse,
  type PurchaseOrderPayload,
} from './contracts/purchaseOrders';

export function listDemands(
  params: DemandListParams,
  signal?: AbortSignal,
): Promise<DemandListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/api/demands${suffix}`, demandListResponseSchema, { signal });
}

export function getDemand(id: string, signal?: AbortSignal): Promise<DemandDetail> {
  return apiRequest(`/api/demands/${id}`, demandDetailSchema, { signal });
}

export function createDemand(body: DemandPayload, csrfToken: string): Promise<DemandDetail> {
  return apiRequest('/api/demands', demandDetailSchema, { method: 'POST', body, csrfToken });
}

export function updateDemand(
  id: string,
  body: Partial<DemandPayload> & { rev: number },
  csrfToken: string,
): Promise<DemandDetail> {
  return apiRequest(`/api/demands/${id}`, demandDetailSchema, {
    method: 'PATCH',
    body,
    csrfToken,
  });
}

export function cancelDemand(
  id: string,
  body: { rev: number; reason: string },
  csrfToken: string,
): Promise<DemandDetail> {
  return apiRequest(`/api/demands/${id}/cancel`, demandDetailSchema, {
    method: 'POST',
    body,
    csrfToken,
  });
}

export function listPurchaseOrders(
  params: PurchaseOrderListParams,
  signal?: AbortSignal,
): Promise<PurchaseOrderListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/api/purchase-orders${suffix}`, purchaseOrderListResponseSchema, { signal });
}

export function getPurchaseOrder(id: string, signal?: AbortSignal): Promise<PurchaseOrderDetail> {
  return apiRequest(`/api/purchase-orders/${id}`, purchaseOrderDetailSchema, { signal });
}

export function createPurchaseOrder(
  body: PurchaseOrderPayload,
  csrfToken: string,
): Promise<PurchaseOrderDetail> {
  return apiRequest('/api/purchase-orders', purchaseOrderDetailSchema, {
    method: 'POST',
    body,
    csrfToken,
  });
}

export function updatePurchaseOrder(
  id: string,
  body: Partial<PurchaseOrderPayload> & { rev: number },
  csrfToken: string,
): Promise<PurchaseOrderDetail> {
  return apiRequest(`/api/purchase-orders/${id}`, purchaseOrderDetailSchema, {
    method: 'PATCH',
    body,
    csrfToken,
  });
}

export function cancelPurchaseOrder(
  id: string,
  body: { rev: number; reason: string },
  csrfToken: string,
): Promise<PurchaseOrderDetail> {
  return apiRequest(`/api/purchase-orders/${id}/cancel`, purchaseOrderDetailSchema, {
    method: 'POST',
    body,
    csrfToken,
  });
}
