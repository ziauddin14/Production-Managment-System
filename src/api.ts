import { healthResponseSchema, type HealthResponse } from './contracts/health';
import { apiBaseUrl } from './config';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl()}/api/health`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`API health check failed (${response.status})`);
  return healthResponseSchema.parse(await response.json());
}
