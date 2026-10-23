import { z } from 'zod';
import { masterRefSchema, type MasterRef, todayInKarachi } from './demands';

export { masterRefSchema, type MasterRef, todayInKarachi };

export const deliveryRouteSchema = z.enum(['WAREHOUSE', 'DIRECT']);
export type DeliveryRoute = z.infer<typeof deliveryRouteSchema>;

export const poCompletionStatusSchema = z.enum(['PENDING', 'PARTIAL', 'COMPLETE']);
export type PoCompletionStatus = z.infer<typeof poCompletionStatusSchema>;

export const paymentScheduleEntrySchema = z.object({
  entryNo: z.number().int(),
  dueDate: z.string(),
  plannedAmount: z.number(),
  note: z.string().nullable(),
});
export type PaymentScheduleEntry = z.infer<typeof paymentScheduleEntrySchema>;

export const invoiceMetaSchema = z.object({
  invoiceNo: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  invoiceAmount: z.number().nullable(),
  notes: z.string().nullable(),
});
export type InvoiceMeta = z.infer<typeof invoiceMetaSchema>;

export const poDemandRefSchema = z.object({
  id: z.string(),
  code: z.string(),
  demandDate: z.string(),
  lineNo: z.number().int().nullable(),
});
export type PoDemandRef = z.infer<typeof poDemandRefSchema>;

export const purchaseOrderLineSchema = z.object({
  id: z.string(),
  lineNo: z.number().int(),
  item: masterRefSchema,
  demand: poDemandRefSchema.nullable(),
  quantityOrdered: z.number().int(),
  quantityReceived: z.number().int(),
  quantityRemaining: z.number().int(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  notes: z.string().nullable(),
  completion: poCompletionStatusSchema,
});
export type PurchaseOrderLine = z.infer<typeof purchaseOrderLineSchema>;

export const purchaseOrderSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  poNumber: z.string(),
  poDate: z.string(),
  status: z.enum(['OPEN', 'CANCELLED']),
  completion: poCompletionStatusSchema,
  vendor: masterRefSchema,
  deliveryRoute: deliveryRouteSchema,
  targetWarehouse: masterRefSchema.nullable(),
  destinationDivision: masterRefSchema.extend({ provinceName: z.string().nullable() }).nullable(),
  approvedAmount: z.number(),
  totalAmount: z.number(),
  lineCount: z.number().int(),
  totalQuantity: z.number().int(),
  expectedCompletionDate: z.string().nullable(),
  rev: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PurchaseOrderSummary = z.infer<typeof purchaseOrderSummarySchema>;

export const purchaseOrderDetailSchema = purchaseOrderSummarySchema.extend({
  notes: z.string().nullable(),
  invoice: invoiceMetaSchema.nullable(),
  paymentSchedule: z.array(paymentScheduleEntrySchema),
  lines: z.array(purchaseOrderLineSchema),
  cancellation: z
    .object({ at: z.string(), reason: z.string(), by: z.string().nullable() })
    .nullable(),
});
export type PurchaseOrderDetail = z.infer<typeof purchaseOrderDetailSchema>;

export const purchaseOrderListResponseSchema = z.object({
  items: z.array(purchaseOrderSummarySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type PurchaseOrderListResponse = z.infer<typeof purchaseOrderListResponseSchema>;

export type PurchaseOrderStatusFilter = 'open' | 'cancelled' | 'all';
export type PurchaseOrderSort =
  'poDate_desc' | 'poDate_asc' | 'code_desc' | 'code_asc' | 'poNumber_desc' | 'poNumber_asc';

export interface PurchaseOrderListParams {
  search?: string;
  status?: PurchaseOrderStatusFilter;
  vendorId?: string;
  deliveryRoute?: DeliveryRoute;
  from?: string;
  to?: string;
  sort?: PurchaseOrderSort;
  page?: number;
  pageSize?: number;
}

export interface PaymentScheduleEntryPayload {
  entryNo?: number;
  dueDate: string;
  plannedAmount: number;
  note?: string | null;
}

export interface InvoicePayload {
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  invoiceAmount?: number | null;
  notes?: string | null;
}

export interface PurchaseOrderLinePayload {
  id?: string;
  itemId: string;
  demandId?: string | null;
  demandLineId?: string | null;
  quantityOrdered: number;
  unitPrice: number;
  notes?: string | null;
}

export interface PurchaseOrderPayload {
  poNumber: string;
  poDate: string;
  vendorId: string;
  deliveryRoute: DeliveryRoute;
  targetWarehouseId?: string | null;
  destinationDivisionId?: string | null;
  approvedAmount: number;
  expectedCompletionDate?: string | null;
  notes?: string | null;
  invoice?: InvoicePayload | null;
  paymentSchedule?: PaymentScheduleEntryPayload[];
  lines: PurchaseOrderLinePayload[];
}

export const PO_COMPLETION_LABELS: Record<PoCompletionStatus, string> = {
  PENDING: 'Pending',
  PARTIAL: 'Partially received',
  COMPLETE: 'Complete',
};

export const DELIVERY_ROUTE_LABELS: Record<DeliveryRoute, string> = {
  WAREHOUSE: 'Warehouse route',
  DIRECT: 'Direct to division',
};
