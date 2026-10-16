import { z } from 'zod';

/**
 * Mirror of the backend's `GET /api/health` response (backend: `src/contracts/api.ts`).
 * The frontend and backend are separate repositories, so this small schema is duplicated
 * instead of imported. Keep it in step with the backend contract.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('mab-pms-api'),
  time: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
