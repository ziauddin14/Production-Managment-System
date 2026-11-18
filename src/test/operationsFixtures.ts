import type {
  DispatchDetail,
  DispatchSummary,
  Payment,
  ReceiptDetail,
  ReceiptSummary,
  ReportResponse,
  StockBalance,
  StockLocation,
  StockMovement,
  SyncJob,
  SyncSummary,
} from '../contracts/operations';
import type { MasterRecord } from '../contracts/masterData';
import { json } from './mockApi';
import {
  PO_ID,
  poRef,
  syntheticDivision,
  syntheticItem,
  syntheticVendor,
  syntheticWarehouse,
} from './purchaseOrderFixtures';

// ---- Synthetic fixtures only: every name is prefixed "Synthetic". ----

export const PO_LINE_ID = '1'.repeat(24);
export const RECEIPT_ID = 'a'.repeat(24);
export const DISPATCH_ID = 'b'.repeat(24);
export const PAYMENT_ID = 'c'.repeat(24);

export function page<T>(items: T[], extra: object = {}) {
  return json(200, { items, page: 1, pageSize: 25, total: items.length, ...extra });
}

export const warehouseLocation = (r: MasterRecord = syntheticWarehouse): StockLocation => ({
  kind: 'WAREHOUSE',
  ...poRef(r),
});
export const divisionLocation = (r: MasterRecord = syntheticDivision): StockLocation => ({
  kind: 'DIVISION',
  ...poRef(r),
});

const lot = {
  purchaseOrderId: PO_ID,
  purchaseOrderCode: 'PO-000001',
  poNumber: 'DIT/0001',
  poLineId: PO_LINE_ID,
  poLineNo: 1,
};

// ---- M7 receiving ----

export function receiptSummary(n: number, overrides: Partial<ReceiptSummary> = {}): ReceiptSummary {
  return {
    id: String(n).padStart(24, 'a'),
    code: `GRN-${String(n).padStart(6, '0')}`,
    receiptDate: '2026-02-01',
    status: 'ACTIVE',
    purchaseOrder: { id: PO_ID, code: 'PO-000001', poNumber: 'DIT/0001' },
    vendor: poRef(syntheticVendor),
    deliveryRoute: 'WAREHOUSE',
    location: warehouseLocation(),
    vendorChallanNo: `SYN-CH-${n}`,
    totalQuantity: 200,
    lineCount: 1,
    rev: 1,
    createdAt: '2026-02-01T05:00:00.000Z',
    createdBy: 'synthetic.operator',
    ...overrides,
  };
}

export function receiptDetail(overrides: Partial<ReceiptDetail> = {}): ReceiptDetail {
  return {
    ...receiptSummary(1, { id: RECEIPT_ID }),
    notes: 'Synthetic receipt note',
    documents: [],
    lines: [
      {
        id: '2'.repeat(24),
        poLineId: PO_LINE_ID,
        poLineNo: 1,
        item: poRef(syntheticItem),
        quantity: 200,
      },
    ],
    cancellation: null,
    ...overrides,
  };
}

// ---- M7 stock ----

export function stockBalance(overrides: Partial<StockBalance> = {}): StockBalance {
  return {
    location: warehouseLocation(),
    item: poRef(syntheticItem),
    lot,
    quantity: 300,
    ...overrides,
  };
}

export function stockMovement(n: number, overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: String(n).padStart(24, '3'),
    movementDate: '2026-02-01',
    recordedAt: '2026-02-01T05:00:00.000Z',
    type: 'RECEIPT',
    location: warehouseLocation(),
    item: poRef(syntheticItem),
    lot,
    quantity: 200,
    source: { kind: 'RECEIPT', id: RECEIPT_ID, code: 'GRN-000001' },
    by: 'synthetic.operator',
    ...overrides,
  };
}

// ---- M8 dispatch ----

export function dispatchSummary(
  n: number,
  overrides: Partial<DispatchSummary> = {},
): DispatchSummary {
  return {
    id: String(n).padStart(24, 'b'),
    code: `DSP-${String(n).padStart(6, '0')}`,
    dispatchDate: '2026-02-10',
    status: 'ACTIVE',
    source: warehouseLocation(),
    destinationDivision: { ...poRef(syntheticDivision), provinceName: 'Synthetic Province A' },
    demand: { id: 'e'.repeat(24), code: 'DMD-000001' },
    biltyNo: `SYN-BLT-${n}`,
    transporterName: 'Synthetic Transport Co',
    vehicleNo: 'SYN-123',
    totalQuantity: 5,
    lineCount: 1,
    rev: 1,
    createdAt: '2026-02-10T05:00:00.000Z',
    createdBy: 'synthetic.operator',
    ...overrides,
  };
}

export function dispatchDetail(overrides: Partial<DispatchDetail> = {}): DispatchDetail {
  return {
    ...dispatchSummary(1, { id: DISPATCH_ID }),
    freightAmount: 1500,
    notes: 'Synthetic dispatch note',
    documents: [{ label: 'Synthetic Bilty scan', url: 'https://example.org/synthetic-bilty' }],
    lines: [
      {
        id: '4'.repeat(24),
        lineNo: 1,
        item: poRef(syntheticItem),
        lot,
        quantity: 5,
        demandLine: { demandId: 'e'.repeat(24), demandCode: 'DMD-000001', lineNo: 1 },
      },
    ],
    cancellation: null,
    ...overrides,
  };
}

// ---- M9 payments ----

export function payment(n: number, overrides: Partial<Payment> = {}): Payment {
  return {
    id: String(n).padStart(24, 'c'),
    code: `PAY-${String(n).padStart(6, '0')}`,
    paymentDate: '2026-02-15',
    status: 'ACTIVE',
    purchaseOrder: { id: PO_ID, code: 'PO-000001', poNumber: 'DIT/0001' },
    vendor: poRef(syntheticVendor),
    amount: 20000,
    method: 'BANK_TRANSFER',
    reference: `SYN-TRX-${n}`,
    scheduleEntryNo: 1,
    notes: null,
    documents: [],
    rev: 1,
    createdAt: '2026-02-15T05:00:00.000Z',
    createdBy: 'synthetic.operator',
    cancellation: null,
    ...overrides,
  };
}

// ---- M10 sync ----

export function syncJob(n: number, overrides: Partial<SyncJob> = {}): SyncJob {
  return {
    id: String(n).padStart(24, '5'),
    workbook: 'Synthetic Workbook',
    sheet: 'POs',
    entity: { collection: 'purchaseOrders', id: PO_ID, code: `PO-${String(n).padStart(6, '0')}` },
    entityRev: 1,
    operation: 'UPSERT',
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    createdAt: '2026-02-01T05:00:00.000Z',
    updatedAt: '2026-02-01T05:00:00.000Z',
    ...overrides,
  };
}

export function syncSummary(overrides: Partial<SyncSummary> = {}): SyncSummary {
  return {
    processorEnabled: false,
    processorNote:
      'Synthetic note: the workbook processor is not enabled yet. Jobs are queued safely.',
    byStatus: [
      { status: 'PENDING', count: 4 },
      { status: 'FAILED', count: 1 },
      { status: 'CONFLICT', count: 1 },
    ],
    byTarget: [
      { workbook: 'Synthetic Workbook', sheet: 'POs', pending: 4, failed: 1, conflict: 1, done: 0 },
    ],
    oldestPendingAt: '2026-02-01T05:00:00.000Z',
    ...overrides,
  };
}

// ---- M11 reports ----

export function report(overrides: Partial<ReportResponse> = {}): ReportResponse {
  return {
    key: 'stock',
    title: 'Synthetic stock report',
    generatedAt: '2026-02-20T05:00:00.000Z',
    columns: [
      { key: 'item', label: 'Item', type: 'text' },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'value', label: 'Value', type: 'money' },
    ],
    rows: [
      { item: 'Synthetic Item One', quantity: 1200, value: 120000 },
      { item: 'Synthetic Item Two', quantity: 30, value: 1500.5 },
    ],
    totals: { quantity: 1230, value: 121500.5 },
    truncated: false,
    ...overrides,
  };
}
