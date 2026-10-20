import type { DemandDetail, DemandSummary, MasterRef } from '../contracts/demands';
import type { MasterRecord } from '../contracts/masterData';
import { json } from './mockApi';

// ---- Synthetic fixtures only: every name is prefixed "Synthetic". ----
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

export const syntheticDepartment = master('d1', 'DEP-000001', 'Synthetic Department');
export const syntheticProvinceA = master('a1', 'PRV-000001', 'Synthetic Province A');
export const syntheticProvinceB = master('b1', 'PRV-000002', 'Synthetic Province B');
export const syntheticDivisionA = master('a2', 'DIV-000001', 'Synthetic Division A1', {
  provinceId: syntheticProvinceA.id,
});
export const syntheticDivisionB = master('b2', 'DIV-000002', 'Synthetic Division B1', {
  provinceId: syntheticProvinceB.id,
});
export const syntheticItem = master('c1', 'ITM-000001', 'Synthetic Item One');
export const syntheticItemTwo = master('c2', 'ITM-000002', 'Synthetic Item Two');

export const ref = (r: MasterRecord): MasterRef => ({
  id: r.id,
  code: r.code,
  name: r.name,
  active: r.active,
});

export function masterPage(items: MasterRecord[]) {
  return json(200, { items, page: 1, pageSize: 100, total: items.length });
}

/** Routes for the master-data lists the demand pages load. */
export const masterRoutes = () => ({
  'GET /api/master/departments': masterPage([syntheticDepartment]),
  'GET /api/master/provinces': masterPage([syntheticProvinceA, syntheticProvinceB]),
  'GET /api/master/divisions': masterPage([syntheticDivisionA, syntheticDivisionB]),
  'GET /api/master/items': masterPage([syntheticItem, syntheticItemTwo]),
});

export const DEMAND_ID = 'e'.repeat(24);

export function demandSummary(n: number, overrides: Partial<DemandSummary> = {}): DemandSummary {
  return {
    id: String(n).padStart(24, 'f'),
    code: `DMD-${String(n).padStart(6, '0')}`,
    demandDate: '2026-01-05',
    status: 'OPEN',
    fulfilment: 'PENDING',
    department: ref(syntheticDepartment),
    province: ref(syntheticProvinceA),
    division: null,
    sourceReference: `Synthetic reference ${n}`,
    lineCount: 1,
    totalQuantity: 10,
    rev: 1,
    createdAt: '2026-01-05T05:00:00.000Z',
    updatedAt: '2026-01-05T05:00:00.000Z',
    ...overrides,
  };
}

export function demandDetail(overrides: Partial<DemandDetail> = {}): DemandDetail {
  return {
    ...demandSummary(1, { id: DEMAND_ID, division: ref(syntheticDivisionA), lineCount: 1 }),
    lines: [
      {
        id: '1'.repeat(24),
        lineNo: 1,
        item: ref(syntheticItem),
        destinationDivision: { ...ref(syntheticDivisionB), provinceName: syntheticProvinceB.name },
        quantity: 10,
        quantityDelivered: 0,
        quantityRemaining: 10,
        fulfilment: 'PENDING',
        receiverName: 'Synthetic Receiver',
        receiverPhone: '0300 0000000',
      },
    ],
    cancellation: null,
    personalDataVisible: true,
    ...overrides,
  };
}

export function listResponse(
  items: DemandSummary[],
  total = items.length,
  page = 1,
  pageSize = 25,
) {
  return json(200, { items, page, pageSize, total });
}
