import { z } from 'zod';
import { sessionUserSchema } from './auth';

/** Mirror of the backend's `GET /api/dashboard/summary` contract. */
export const dashboardIndicatorSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  status: z.enum(['available', 'not_available']),
  value: z.number().nullable(),
  plannedMilestone: z.string().nullable(),
});
export type DashboardIndicator = z.infer<typeof dashboardIndicatorSchema>;

export const dashboardSummarySchema = z.object({
  generatedAt: z.string(),
  user: sessionUserSchema,
  indicators: z.array(dashboardIndicatorSchema),
  system: z.object({ database: z.enum(['up', 'down']) }),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
