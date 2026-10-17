import { z } from 'zod';

/** Mirror of the backend master-data contract (backend: `src/contracts/api.ts`). */
export const masterEntityKeys = [
  'provinces',
  'divisions',
  'departments',
  'items',
  'vendors',
  'warehouses',
] as const;
export type MasterEntityKey = (typeof masterEntityKeys)[number];

export const masterRecordSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
  rev: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  provinceId: z.string().optional(),
  provinceName: z.string().optional(),
});
export type MasterRecord = z.infer<typeof masterRecordSchema>;

export const masterListResponseSchema = z.object({
  items: z.array(masterRecordSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type MasterListResponse = z.infer<typeof masterListResponseSchema>;

export type MasterStatusFilter = 'active' | 'inactive' | 'all';

export interface MasterListParams {
  search?: string;
  status?: MasterStatusFilter;
  page?: number;
  pageSize?: number;
  provinceId?: string;
}

export interface MasterEntityMeta {
  key: MasterEntityKey;
  label: string;
  singular: string;
  description: string;
}

/** Display metadata for each master list (BRD Module 2 plus warehouses from M1). */
export const MASTER_ENTITY_META: Record<MasterEntityKey, MasterEntityMeta> = {
  provinces: {
    key: 'provinces',
    label: 'Provinces',
    singular: 'province',
    description: 'Requesting provinces. Divisions belong to a province.',
  },
  divisions: {
    key: 'divisions',
    label: 'Divisions',
    singular: 'division',
    description: 'Divisions within a province.',
  },
  departments: {
    key: 'departments',
    label: 'Departments',
    singular: 'department',
    description: 'Departments that raise demands.',
  },
  items: {
    key: 'items',
    label: 'Items',
    singular: 'item',
    description: 'Products that are demanded, ordered, stocked and dispatched.',
  },
  vendors: {
    key: 'vendors',
    label: 'Vendors',
    singular: 'vendor',
    description: 'Suppliers who receive purchase orders.',
  },
  warehouses: {
    key: 'warehouses',
    label: 'Warehouses',
    singular: 'warehouse',
    description: 'Locations where physical stock is held.',
  },
};
