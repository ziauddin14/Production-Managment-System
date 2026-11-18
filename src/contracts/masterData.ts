import { z } from 'zod';

/** Mirror of the backend master-data contract (backend: `src/contracts/api.ts`). */
export const masterEntityKeys = [
  'provinces',
  'divisions',
  'districts',
  'cities',
  'departments',
  'items',
  'vendors',
  'warehouses',
  'receivers',
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
  /** Location records carry every level above them. */
  provinceId: z.string().optional(),
  provinceName: z.string().optional(),
  divisionId: z.string().optional(),
  divisionName: z.string().optional(),
  districtId: z.string().optional(),
  districtName: z.string().optional(),
  cityId: z.string().optional(),
  cityName: z.string().optional(),
  /** Vendors only. */
  contactPerson: z.string().nullable().optional(),
  /** Receivers only (personal data; the list is visible to the Production Operator only). */
  phone: z.string().nullable().optional(),
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

export type MasterParentField = 'provinceId' | 'divisionId' | 'districtId' | 'cityId';

export interface MasterListParams {
  search?: string;
  status?: MasterStatusFilter;
  page?: number;
  pageSize?: number;
  provinceId?: string;
  divisionId?: string;
  districtId?: string;
  cityId?: string;
}

/** One level of the location chain (province → division → district → city). */
export interface LocationLevel {
  entity: MasterEntityKey;
  /** Field that points at this level from the level below. */
  field: MasterParentField;
  /** Field of this level that points at the level above, if any. */
  parentField?: MasterParentField;
  label: string;
  /** Record field holding the name of this level. */
  nameField: 'provinceName' | 'divisionName' | 'districtName' | 'cityName';
}

export const LOCATION_LEVELS: LocationLevel[] = [
  { entity: 'provinces', field: 'provinceId', label: 'Province', nameField: 'provinceName' },
  {
    entity: 'divisions',
    field: 'divisionId',
    parentField: 'provinceId',
    label: 'Division',
    nameField: 'divisionName',
  },
  {
    entity: 'districts',
    field: 'districtId',
    parentField: 'divisionId',
    label: 'District',
    nameField: 'districtName',
  },
  {
    entity: 'cities',
    field: 'cityId',
    parentField: 'districtId',
    label: 'City',
    nameField: 'cityName',
  },
];

/** Lists with personal data: only the Production Operator may see them (Q-30). */
export const OPERATOR_ONLY_ENTITIES: readonly MasterEntityKey[] = ['receivers'];

/** The levels above a location list, top first (e.g. cities: province, division, district). */
export function ancestorsOf(entity: MasterEntityKey): LocationLevel[] {
  const depth = { divisions: 1, districts: 2, cities: 3, receivers: 4 }[entity as string] ?? 0;
  return LOCATION_LEVELS.slice(0, depth);
}

export interface MasterEntityMeta {
  key: MasterEntityKey;
  label: string;
  singular: string;
  description: string;
  /** Heading of the name column. */
  nameHeader: string;
}

/** Display metadata for each master list (BRD Module 2 plus warehouses from M1). */
export const MASTER_ENTITY_META: Record<MasterEntityKey, MasterEntityMeta> = {
  provinces: {
    key: 'provinces',
    label: 'Provinces',
    singular: 'province',
    description: 'Requesting provinces. Divisions belong to a province.',
    nameHeader: 'Province',
  },
  divisions: {
    key: 'divisions',
    label: 'Divisions',
    singular: 'division',
    description: 'Divisions within a province. Districts belong to a division.',
    nameHeader: 'Division',
  },
  districts: {
    key: 'districts',
    label: 'Districts',
    singular: 'district',
    description: 'Districts within a division. Cities belong to a district.',
    nameHeader: 'District',
  },
  cities: {
    key: 'cities',
    label: 'Cities',
    singular: 'city',
    description: 'Cities and areas, with their district, division and province.',
    nameHeader: 'City',
  },
  departments: {
    key: 'departments',
    label: 'Departments',
    singular: 'department',
    description: 'Departments that raise demands.',
    nameHeader: 'Name',
  },
  items: {
    key: 'items',
    label: 'Items',
    singular: 'item',
    description: 'Products that are demanded, ordered, stocked and dispatched.',
    nameHeader: 'Name',
  },
  vendors: {
    key: 'vendors',
    label: 'Vendors',
    singular: 'vendor',
    description: 'Suppliers who receive purchase orders.',
    nameHeader: 'Company name',
  },
  warehouses: {
    key: 'warehouses',
    label: 'Warehouses',
    singular: 'warehouse',
    description: 'Locations where physical stock is held.',
    nameHeader: 'Name',
  },
  receivers: {
    key: 'receivers',
    label: 'Receivers',
    singular: 'receiver',
    description:
      'Division receivers (name and phone) per city. Choosing a city on a demand line fills them in.',
    nameHeader: 'Receiver',
  },
};
