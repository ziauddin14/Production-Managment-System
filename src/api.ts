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
import {
  dispatchDetailSchema,
  dispatchListResponseSchema,
  paymentListResponseSchema,
  paymentSchema,
  receiptDetailSchema,
  receiptListResponseSchema,
  reportResponseSchema,
  stockBalanceResponseSchema,
  stockMovementResponseSchema,
  syncJobListResponseSchema,
  syncJobSchema,
  syncSummarySchema,
  type DispatchDetail,
  type DispatchListParams,
  type DispatchListResponse,
  type DispatchPayload,
  type DispatchUpdatePayload,
  type Payment,
  type PaymentListParams,
  type PaymentListResponse,
  type PaymentPayload,
  type ReceiptDetail,
  type ReceiptListParams,
  type ReceiptListResponse,
  type ReceiptPayload,
  type ReportKey,
  type ReportParams,
  type ReportResponse,
  type StockBalance,
  type StockBalanceParams,
  type StockBalanceResponse,
  type StockMovementParams,
  type StockMovementResponse,
  type SyncJob,
  type SyncJobListParams,
  type SyncJobListResponse,
  type SyncSummary,
} from './contracts/operations';
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

/** Turns a failed response into an ApiError, using the server's error body when it has one. */
async function errorFromResponse(response: Response): Promise<ApiError> {
  const parsed = apiErrorResponseSchema.safeParse(await response.json().catch(() => null));
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(response.status, code, message, details);
  }
  return new ApiError(
    response.status,
    'UNKNOWN_ERROR',
    `Unexpected server response (${response.status})`,
  );
}

/** Builds "?a=1&b=2" from defined, non-empty values (or "" when there are none). */
export function toQueryString(params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
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

  if (!response.ok) throw await errorFromResponse(response);
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
  if (params.divisionId) query.set('divisionId', params.divisionId);
  if (params.districtId) query.set('districtId', params.districtId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest(`/api/master/${entity}${suffix}`, masterListResponseSchema, { signal });
}

/** Optional fields of a master record write; each list accepts only its own. */
export interface MasterWriteFields {
  provinceId?: string;
  divisionId?: string;
  districtId?: string;
  contactPerson?: string;
}

export function createMasterRecord(
  entity: MasterEntityKey,
  body: { name: string } & MasterWriteFields,
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
  body: { rev: number; name?: string; active?: boolean } & MasterWriteFields,
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

// ---- M7 Goods receiving and stock ----------------------------------------------------------

export function listReceipts(
  params: ReceiptListParams,
  signal?: AbortSignal,
): Promise<ReceiptListResponse> {
  return apiRequest(`/api/receipts${toQueryString(params)}`, receiptListResponseSchema, {
    signal,
  });
}

export function getReceipt(id: string, signal?: AbortSignal): Promise<ReceiptDetail> {
  return apiRequest(`/api/receipts/${id}`, receiptDetailSchema, { signal });
}

export function createReceipt(body: ReceiptPayload, csrfToken: string): Promise<ReceiptDetail> {
  return apiRequest('/api/receipts', receiptDetailSchema, { method: 'POST', body, csrfToken });
}

export function cancelReceipt(
  id: string,
  body: { rev: number; reason: string },
  csrfToken: string,
): Promise<ReceiptDetail> {
  return apiRequest(`/api/receipts/${id}/cancel`, receiptDetailSchema, {
    method: 'POST',
    body,
    csrfToken,
  });
}

export function listStockBalances(
  params: StockBalanceParams,
  signal?: AbortSignal,
): Promise<StockBalanceResponse> {
  return apiRequest(`/api/stock/balances${toQueryString(params)}`, stockBalanceResponseSchema, {
    signal,
  });
}

/** Loads every stock balance matching the filter (pages of 100), for selection lists. */
export async function listAllStockBalances(
  params: Omit<StockBalanceParams, 'page' | 'pageSize'>,
  signal?: AbortSignal,
): Promise<StockBalance[]> {
  const all: StockBalance[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const result = await listStockBalances({ ...params, page, pageSize: 100 }, signal);
    all.push(...result.items);
    if (all.length >= result.total || result.items.length === 0) break;
  }
  return all;
}

export function listStockMovements(
  params: StockMovementParams,
  signal?: AbortSignal,
): Promise<StockMovementResponse> {
  return apiRequest(`/api/stock/movements${toQueryString(params)}`, stockMovementResponseSchema, {
    signal,
  });
}

// ---- M8 Dispatch / Bilty --------------------------------------------------------------------

export function listDispatches(
  params: DispatchListParams,
  signal?: AbortSignal,
): Promise<DispatchListResponse> {
  return apiRequest(`/api/dispatches${toQueryString(params)}`, dispatchListResponseSchema, {
    signal,
  });
}

export function getDispatch(id: string, signal?: AbortSignal): Promise<DispatchDetail> {
  return apiRequest(`/api/dispatches/${id}`, dispatchDetailSchema, { signal });
}

export function createDispatch(body: DispatchPayload, csrfToken: string): Promise<DispatchDetail> {
  return apiRequest('/api/dispatches', dispatchDetailSchema, { method: 'POST', body, csrfToken });
}

export function updateDispatch(
  id: string,
  body: DispatchUpdatePayload,
  csrfToken: string,
): Promise<DispatchDetail> {
  return apiRequest(`/api/dispatches/${id}`, dispatchDetailSchema, {
    method: 'PATCH',
    body,
    csrfToken,
  });
}

export function cancelDispatch(
  id: string,
  body: { rev: number; reason: string },
  csrfToken: string,
): Promise<DispatchDetail> {
  return apiRequest(`/api/dispatches/${id}/cancel`, dispatchDetailSchema, {
    method: 'POST',
    body,
    csrfToken,
  });
}

// ---- M9 Vendor payments ---------------------------------------------------------------------

export function listPayments(
  params: PaymentListParams,
  signal?: AbortSignal,
): Promise<PaymentListResponse> {
  return apiRequest(`/api/payments${toQueryString(params)}`, paymentListResponseSchema, {
    signal,
  });
}

export function getPayment(id: string, signal?: AbortSignal): Promise<Payment> {
  return apiRequest(`/api/payments/${id}`, paymentSchema, { signal });
}

export function createPayment(body: PaymentPayload, csrfToken: string): Promise<Payment> {
  return apiRequest('/api/payments', paymentSchema, { method: 'POST', body, csrfToken });
}

export function cancelPayment(
  id: string,
  body: { rev: number; reason: string },
  csrfToken: string,
): Promise<Payment> {
  return apiRequest(`/api/payments/${id}/cancel`, paymentSchema, {
    method: 'POST',
    body,
    csrfToken,
  });
}

// ---- M10 Excel sync status ------------------------------------------------------------------

export function getSyncSummary(signal?: AbortSignal): Promise<SyncSummary> {
  return apiRequest('/api/sync/summary', syncSummarySchema, { signal });
}

export function listSyncJobs(
  params: SyncJobListParams,
  signal?: AbortSignal,
): Promise<SyncJobListResponse> {
  return apiRequest(`/api/sync/jobs${toQueryString(params)}`, syncJobListResponseSchema, {
    signal,
  });
}

export function retrySyncJob(id: string, csrfToken: string): Promise<SyncJob> {
  return apiRequest(`/api/sync/jobs/${id}/retry`, syncJobSchema, { method: 'POST', csrfToken });
}

// ---- M11 Reports ----------------------------------------------------------------------------

export function getReport(
  key: ReportKey,
  params: ReportParams,
  signal?: AbortSignal,
): Promise<ReportResponse> {
  return apiRequest(
    `/api/reports/${key}${toQueryString({ ...params, format: 'json' })}`,
    reportResponseSchema,
    { signal },
  );
}

/** Downloads a report as CSV. The session cookie is sent, so the request is authenticated. */
export async function downloadReportCsv(key: ReportKey, params: ReportParams): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(
      `${apiBaseUrl()}/api/reports/${key}${toQueryString({ ...params, format: 'csv' })}`,
      { method: 'GET', headers: { Accept: 'text/csv' }, credentials: 'include' },
    );
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'The PMS server could not be reached. Check your connection and try again.',
    );
  }
  if (!response.ok) throw await errorFromResponse(response);
  return response.blob();
}
