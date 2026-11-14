import { z } from 'zod';
import { masterRefSchema } from './demands';

/**
 * Mirror of the backend operations contract (backend: `src/contracts/operations.ts`): M7 receiving
 * & stock, M8 dispatch/Bilty, M9 vendor payments, M10 sync status and M11 reports. Only response
 * schemas are validated here; request bodies are typed and validated by the forms (and again by
 * the server, which is authoritative).
 */

export type RecordStatusFilter = 'open' | 'cancelled' | 'all';
export type RecordStatus = 'ACTIVE' | 'CANCELLED';

export const documentRefSchema = z.object({ label: z.string(), url: z.string() });
export type DocumentRef = z.infer<typeof documentRefSchema>;

export const stockLocationKinds = ['WAREHOUSE', 'DIVISION'] as const;
export const stockLocationKindSchema = z.enum(stockLocationKinds);
export type StockLocationKind = z.infer<typeof stockLocationKindSchema>;

export const stockLocationSchema = z.object({
  kind: stockLocationKindSchema,
  id: z.string(),
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export type StockLocation = z.infer<typeof stockLocationSchema>;

export const poLotRefSchema = z.object({
  purchaseOrderId: z.string(),
  purchaseOrderCode: z.string(),
  poNumber: z.string(),
  poLineId: z.string(),
  poLineNo: z.number().int(),
});
export type PoLotRef = z.infer<typeof poLotRefSchema>;

const cancellationSchema = z
  .object({ at: z.string(), reason: z.string(), by: z.string().nullable() })
  .nullable();

const recordStatusSchema = z.enum(['ACTIVE', 'CANCELLED']);
const poRefSchema = z.object({ id: z.string(), code: z.string(), poNumber: z.string() });

function pageOf<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

// ---- M7 Goods receiving ----------------------------------------------------------------------

export const receiptLineSchema = z.object({
  id: z.string(),
  poLineId: z.string(),
  poLineNo: z.number().int(),
  item: masterRefSchema,
  quantity: z.number().int(),
});
export type ReceiptLine = z.infer<typeof receiptLineSchema>;

export const receiptSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  receiptDate: z.string(),
  status: recordStatusSchema,
  purchaseOrder: poRefSchema,
  vendor: masterRefSchema,
  deliveryRoute: z.enum(['WAREHOUSE', 'DIRECT']),
  location: stockLocationSchema,
  vendorChallanNo: z.string().nullable(),
  totalQuantity: z.number().int(),
  lineCount: z.number().int(),
  rev: z.number().int(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});
export type ReceiptSummary = z.infer<typeof receiptSummarySchema>;

export const receiptDetailSchema = receiptSummarySchema.extend({
  notes: z.string().nullable(),
  lines: z.array(receiptLineSchema),
  cancellation: cancellationSchema,
});
export type ReceiptDetail = z.infer<typeof receiptDetailSchema>;

export const receiptListResponseSchema = pageOf(receiptSummarySchema);
export type ReceiptListResponse = z.infer<typeof receiptListResponseSchema>;

export interface ReceiptListParams {
  search?: string;
  status?: RecordStatusFilter;
  purchaseOrderId?: string;
  vendorId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface ReceiptPayload {
  purchaseOrderId: string;
  receiptDate: string;
  vendorChallanNo?: string | null;
  notes?: string | null;
  lines: Array<{ poLineId: string; quantity: number }>;
}

// ---- M7 Stock balances and inventory ledger ---------------------------------------------------

export const stockBalanceSchema = z.object({
  location: stockLocationSchema,
  item: masterRefSchema,
  lot: poLotRefSchema,
  quantity: z.number().int(),
});
export type StockBalance = z.infer<typeof stockBalanceSchema>;

export const stockBalanceResponseSchema = pageOf(stockBalanceSchema).extend({
  /** Units held across every row matching the filter (not only this page). */
  totalQuantity: z.number().int(),
});
export type StockBalanceResponse = z.infer<typeof stockBalanceResponseSchema>;

export interface StockBalanceParams {
  locationKind?: StockLocationKind;
  locationId?: string;
  itemId?: string;
  purchaseOrderId?: string;
  includeZero?: 'true' | 'false';
  page?: number;
  pageSize?: number;
}

export const stockMovementTypes = [
  'RECEIPT',
  'RECEIPT_CANCELLED',
  'DISPATCH',
  'DISPATCH_CANCELLED',
] as const;
export type StockMovementType = (typeof stockMovementTypes)[number];

export const stockMovementSchema = z.object({
  id: z.string(),
  movementDate: z.string(),
  recordedAt: z.string(),
  type: z.enum(stockMovementTypes),
  location: stockLocationSchema,
  item: masterRefSchema,
  lot: poLotRefSchema,
  /** Positive = into the location, negative = out of it. */
  quantity: z.number().int(),
  source: z.object({ kind: z.enum(['RECEIPT', 'DISPATCH']), id: z.string(), code: z.string() }),
  by: z.string().nullable(),
});
export type StockMovement = z.infer<typeof stockMovementSchema>;

export const stockMovementResponseSchema = pageOf(stockMovementSchema);
export type StockMovementResponse = z.infer<typeof stockMovementResponseSchema>;

export interface StockMovementParams {
  locationKind?: StockLocationKind;
  locationId?: string;
  itemId?: string;
  purchaseOrderId?: string;
  type?: StockMovementType;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// ---- M8 Dispatch, Bilty and documents ----------------------------------------------------------

export const dispatchLineSchema = z.object({
  id: z.string(),
  lineNo: z.number().int(),
  item: masterRefSchema,
  lot: poLotRefSchema,
  quantity: z.number().int(),
  demandLine: z
    .object({ demandId: z.string(), demandCode: z.string(), lineNo: z.number().int() })
    .nullable(),
});
export type DispatchLine = z.infer<typeof dispatchLineSchema>;

export const dispatchSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  dispatchDate: z.string(),
  status: recordStatusSchema,
  source: stockLocationSchema,
  destinationDivision: masterRefSchema.extend({ provinceName: z.string().nullable() }),
  demand: z.object({ id: z.string(), code: z.string() }).nullable(),
  biltyNo: z.string().nullable(),
  transporterName: z.string().nullable(),
  vehicleNo: z.string().nullable(),
  totalQuantity: z.number().int(),
  lineCount: z.number().int(),
  rev: z.number().int(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
});
export type DispatchSummary = z.infer<typeof dispatchSummarySchema>;

export const dispatchDetailSchema = dispatchSummarySchema.extend({
  freightAmount: z.number().nullable(),
  notes: z.string().nullable(),
  documents: z.array(documentRefSchema),
  lines: z.array(dispatchLineSchema),
  cancellation: cancellationSchema,
});
export type DispatchDetail = z.infer<typeof dispatchDetailSchema>;

export const dispatchListResponseSchema = pageOf(dispatchSummarySchema);
export type DispatchListResponse = z.infer<typeof dispatchListResponseSchema>;

export interface DispatchListParams {
  search?: string;
  status?: RecordStatusFilter;
  destinationDivisionId?: string;
  sourceKind?: StockLocationKind;
  sourceId?: string;
  demandId?: string;
  purchaseOrderId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface DispatchPayload {
  dispatchDate: string;
  sourceKind: StockLocationKind;
  sourceId: string;
  destinationDivisionId: string;
  demandId?: string | null;
  biltyNo?: string | null;
  transporterName?: string | null;
  vehicleNo?: string | null;
  freightAmount?: number | null;
  notes?: string | null;
  documents?: DocumentRef[];
  lines: Array<{ poLineId: string; quantity: number; demandLineId?: string | null }>;
}

/** Bilty / transport details and documents can be completed after the dispatch is recorded. */
export interface DispatchUpdatePayload {
  rev: number;
  biltyNo?: string | null;
  transporterName?: string | null;
  vehicleNo?: string | null;
  freightAmount?: number | null;
  notes?: string | null;
  documents?: DocumentRef[];
}

// ---- M9 Vendor payments -----------------------------------------------------------------------

export const paymentMethods = ['BANK_TRANSFER', 'CHEQUE', 'CASH', 'OTHER'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentSchema = z.object({
  id: z.string(),
  code: z.string(),
  paymentDate: z.string(),
  status: recordStatusSchema,
  purchaseOrder: poRefSchema,
  vendor: masterRefSchema,
  amount: z.number(),
  method: z.enum(paymentMethods),
  reference: z.string().nullable(),
  scheduleEntryNo: z.number().int().nullable(),
  notes: z.string().nullable(),
  documents: z.array(documentRefSchema),
  rev: z.number().int(),
  createdAt: z.string(),
  createdBy: z.string().nullable(),
  cancellation: cancellationSchema,
});
export type Payment = z.infer<typeof paymentSchema>;

export const paymentListResponseSchema = pageOf(paymentSchema);
export type PaymentListResponse = z.infer<typeof paymentListResponseSchema>;

export interface PaymentListParams {
  search?: string;
  status?: RecordStatusFilter;
  purchaseOrderId?: string;
  vendorId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentPayload {
  purchaseOrderId: string;
  paymentDate: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  scheduleEntryNo?: number | null;
  notes?: string | null;
  documents?: DocumentRef[];
}

export const paymentStatuses = ['UNPAID', 'PARTIAL', 'PAID'] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

// ---- M10 Excel sync status --------------------------------------------------------------------

export const syncJobStatuses = [
  'PENDING',
  'LEASED',
  'DONE',
  'RETRY',
  'CONFLICT',
  'FAILED',
] as const;
export type SyncJobStatus = (typeof syncJobStatuses)[number];

export const syncJobSchema = z.object({
  id: z.string(),
  workbook: z.string(),
  sheet: z.string().nullable(),
  entity: z.object({ collection: z.string(), id: z.string(), code: z.string() }),
  entityRev: z.number().int(),
  operation: z.string(),
  status: z.enum(syncJobStatuses),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SyncJob = z.infer<typeof syncJobSchema>;

export const syncJobListResponseSchema = pageOf(syncJobSchema);
export type SyncJobListResponse = z.infer<typeof syncJobListResponseSchema>;

export interface SyncJobListParams {
  status?: SyncJobStatus;
  workbook?: string;
  page?: number;
  pageSize?: number;
}

export const syncSummarySchema = z.object({
  processorEnabled: z.boolean(),
  processorNote: z.string(),
  byStatus: z.array(z.object({ status: z.enum(syncJobStatuses), count: z.number().int() })),
  byTarget: z.array(
    z.object({
      workbook: z.string(),
      sheet: z.string().nullable(),
      pending: z.number().int(),
      failed: z.number().int(),
      conflict: z.number().int(),
      done: z.number().int(),
    }),
  ),
  oldestPendingAt: z.string().nullable(),
});
export type SyncSummary = z.infer<typeof syncSummarySchema>;

// ---- M11 Reports ------------------------------------------------------------------------------

export const reportKeys = [
  'purchase-orders',
  'receipts',
  'stock',
  'dispatches',
  'payments',
  'demands',
  'vendors',
] as const;
export type ReportKey = (typeof reportKeys)[number];

export const reportColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'money']),
});
export type ReportColumn = z.infer<typeof reportColumnSchema>;

export const reportResponseSchema = z.object({
  key: z.enum(reportKeys),
  title: z.string(),
  generatedAt: z.string(),
  columns: z.array(reportColumnSchema),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  totals: z.record(z.string(), z.number()),
  /** True when the row limit cut the result; narrow the filters to see everything. */
  truncated: z.boolean(),
});
export type ReportResponse = z.infer<typeof reportResponseSchema>;

export interface ReportParams {
  from?: string;
  to?: string;
  vendorId?: string;
  itemId?: string;
  provinceId?: string;
  divisionId?: string;
  warehouseId?: string;
  includeCancelled?: 'true' | 'false';
}

// ---- Display labels ---------------------------------------------------------------------------

export const LOCATION_KIND_LABELS: Record<StockLocationKind, string> = {
  WAREHOUSE: 'Warehouse',
  DIVISION: 'Division (direct delivery)',
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  RECEIPT: 'Receipt',
  RECEIPT_CANCELLED: 'Receipt cancelled',
  DISPATCH: 'Dispatch',
  DISPATCH_CANCELLED: 'Dispatch cancelled',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  CASH: 'Cash',
  OTHER: 'Other',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partially paid',
  PAID: 'Paid',
};

export const SYNC_STATUS_LABELS: Record<SyncJobStatus, string> = {
  PENDING: 'Pending',
  LEASED: 'In progress',
  DONE: 'Done',
  RETRY: 'Waiting to retry',
  CONFLICT: 'Conflict',
  FAILED: 'Failed',
};

export const REPORT_LABELS: Record<ReportKey, string> = {
  'purchase-orders': 'Purchase orders',
  receipts: 'Goods receipts',
  stock: 'Stock on hand',
  dispatches: 'Dispatches',
  payments: 'Vendor payments',
  demands: 'Demands',
  vendors: 'Vendor summary',
};

/** "Warehouse A" or "Division B (direct delivery)" for a stock location. */
export function locationLabel(location: StockLocation): string {
  return location.kind === 'WAREHOUSE'
    ? `${location.name} (warehouse)`
    : `${location.name} (division)`;
}
