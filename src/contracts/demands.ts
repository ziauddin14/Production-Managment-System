import { z } from 'zod';

/** Mirror of the backend demand contract (backend: `src/contracts/api.ts`). */
export const masterRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export type MasterRef = z.infer<typeof masterRefSchema>;

const fulfilment = z.enum(['PENDING', 'PARTIAL', 'DELIVERED']);
export type Fulfilment = z.infer<typeof fulfilment>;

export const demandSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  demandDate: z.string(),
  status: z.enum(['OPEN', 'CANCELLED']),
  fulfilment,
  department: masterRefSchema,
  province: masterRefSchema,
  division: masterRefSchema.nullable(),
  sourceReference: z.string().nullable(),
  lineCount: z.number().int(),
  totalQuantity: z.number().int(),
  rev: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DemandSummary = z.infer<typeof demandSummarySchema>;

export const demandLineSchema = z.object({
  id: z.string(),
  lineNo: z.number().int(),
  item: masterRefSchema,
  destinationDivision: masterRefSchema.extend({ provinceName: z.string().nullable() }),
  quantity: z.number().int(),
  quantityDelivered: z.number().int(),
  quantityRemaining: z.number().int(),
  fulfilment,
  receiverName: z.string().nullable().optional(),
  receiverPhone: z.string().nullable().optional(),
});
export type DemandLine = z.infer<typeof demandLineSchema>;

export const demandDetailSchema = demandSummarySchema.extend({
  lines: z.array(demandLineSchema),
  cancellation: z
    .object({ at: z.string(), reason: z.string(), by: z.string().nullable() })
    .nullable(),
  personalDataVisible: z.boolean(),
});
export type DemandDetail = z.infer<typeof demandDetailSchema>;

export const demandListResponseSchema = z.object({
  items: z.array(demandSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type DemandListResponse = z.infer<typeof demandListResponseSchema>;

export type DemandStatusFilter = 'open' | 'cancelled' | 'all';
export type DemandSort = 'demandDate_desc' | 'demandDate_asc' | 'code_desc' | 'code_asc';

export interface DemandListParams {
  search?: string;
  status?: DemandStatusFilter;
  departmentId?: string;
  provinceId?: string;
  from?: string;
  to?: string;
  sort?: DemandSort;
  page?: number;
  pageSize?: number;
}

export interface DemandLinePayload {
  id?: string;
  itemId: string;
  destinationDivisionId: string;
  quantity: number;
  receiverName?: string | null;
  receiverPhone?: string | null;
}

export interface DemandPayload {
  demandDate: string;
  departmentId: string;
  provinceId: string;
  divisionId?: string | null;
  sourceReference?: string | null;
  lines: DemandLinePayload[];
}

export const FULFILMENT_LABELS: Record<Fulfilment, string> = {
  PENDING: 'Pending',
  PARTIAL: 'Partially delivered',
  DELIVERED: 'Delivered',
};

/** Today in the organisation's time zone (Asia/Karachi), YYYY-MM-DD — matches the server rule. */
export function todayInKarachi(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
