import type {
  PurchaseOrderDetail,
  PurchaseOrderSummary,
  MasterRef,
} from '../contracts/purchaseOrders';
import type { MasterRecord } from '../contracts/masterData';
import { json } from './mockApi';

function master(id: string, code: string, name: string, extra: Partial<MasterRecord> = {}) {
  return {
    id: id.padStart(24, '0'),
    code,
    name,
    active: true,
    rev: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  } satisfies MasterRecord;
}

export const syntheticVendor = master('v1', 'VND-000001', 'Synthetic Vendor One');
export const syntheticVendorTwo = master('v2', 'VND-000002', 'Synthetic Vendor Two');
export const syntheticWarehouse = master('w1', 'WHS-000001', 'Synthetic Warehouse FEM');
export const syntheticDivision = master('a2', 'DIV-000001', 'Synthetic Division A1');
export const syntheticItem = master('c1', 'ITM-000001', 'Synthetic Item One');
export const syntheticItemTwo = master('c2', 'ITM-000002', 'Synthetic Item Two');

export const poRef = (r: MasterRecord): MasterRef => ({
  id: r.id,
  code: r.code,
  name: r.name,
  active: r.active,
});

export function masterPage(items: MasterRecord[]) {
  return json(200, { items, page: 1, pageSize: 100, total: items.length });
}

export const poMasterRoutes = () => ({
  'GET /api/master/vendors': masterPage([syntheticVendor, syntheticVendorTwo]),
  'GET /api/master/warehouses': masterPage([syntheticWarehouse]),
  'GET /api/master/divisions': masterPage([syntheticDivision]),
  'GET /api/master/items': masterPage([syntheticItem, syntheticItemTwo]),
  'GET /api/demands': json(200, { items: [], page: 1, pageSize: 100, total: 0 }),
});

export const PO_ID = 'e'.repeat(24);

export function poSummary(
  n: number,
  overrides: Partial<PurchaseOrderSummary> = {},
): PurchaseOrderSummary {
  return {
    id: String(n).padStart(24, 'f'),
    code: `PO-${String(n).padStart(6, '0')}`,
    poNumber: `DIT/${String(n).padStart(4, '0')}`,
    poDate: '2026-01-15',
    status: 'OPEN',
    completion: 'PENDING',
    vendor: poRef(syntheticVendor),
    deliveryRoute: 'WAREHOUSE',
    targetWarehouse: poRef(syntheticWarehouse),
    destinationDivision: null,
    approvedAmount: 50000,
    totalAmount: 50000,
    lineCount: 1,
    totalQuantity: 500,
    expectedCompletionDate: '2026-02-15',
    rev: 1,
    createdAt: '2026-01-15T05:00:00.000Z',
    updatedAt: '2026-01-15T05:00:00.000Z',
    ...overrides,
  };
}

export function poDetail(overrides: Partial<PurchaseOrderDetail> = {}): PurchaseOrderDetail {
  return {
    ...poSummary(1, { id: PO_ID }),
    notes: 'Synthetic PO notes',
    invoice: {
      invoiceNo: 'INV-001',
      invoiceDate: '2026-01-15',
      invoiceAmount: 50000,
      notes: 'Synthetic invoice note',
    },
    paymentSchedule: [
      {
        entryNo: 1,
        dueDate: '2026-01-20',
        plannedAmount: 25000,
        note: '50% advance',
      },
      {
        entryNo: 2,
        dueDate: '2026-02-20',
        plannedAmount: 25000,
        note: 'Balance',
      },
    ],
    lines: [
      {
        id: '1'.repeat(24),
        lineNo: 1,
        item: poRef(syntheticItem),
        demand: null,
        quantityOrdered: 500,
        quantityReceived: 0,
        quantityRemaining: 500,
        unitPrice: 100,
        lineTotal: 50000,
        notes: 'Synthetic line note',
        completion: 'PENDING',
      },
    ],
    cancellation: null,
    ...overrides,
  };
}

export function poListResponse(
  items: PurchaseOrderSummary[],
  total = items.length,
  page = 1,
  pageSize = 25,
) {
  return json(200, { items, page, pageSize, total });
}
