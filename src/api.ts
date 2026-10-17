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
