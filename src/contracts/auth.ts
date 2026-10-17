import { z } from 'zod';

/**
 * Mirrors of the backend auth and error contracts (backend: `src/contracts/api.ts`).
 * Keep in step with the backend when the contract changes.
 */
export const userRoles = ['OPERATOR', 'VIEWER'] as const;
export type UserRole = (typeof userRoles)[number];

export const sessionUserSchema = z.object({
  id: z.string(),
  code: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(userRoles),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionResponseSchema = z.object({
  user: sessionUserSchema,
  csrfToken: z.string(),
  expiresAt: z.string(),
  idleExpiresAt: z.string(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});

export const ROLE_LABELS: Record<UserRole, string> = {
  OPERATOR: 'Production Operator',
  VIEWER: 'Read-only',
};
