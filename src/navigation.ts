import {
  BarChart3,
  Boxes,
  ClipboardList,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Present for modules that are not built yet: the milestone that will deliver them. */
  plannedMilestone?: string;
  description?: string;
}

export const DASHBOARD_NAV: NavItem = {
  key: 'dashboard',
  label: 'Dashboard',
  path: '/',
  icon: LayoutDashboard,
};

/** Modules that are built and working. */
export const ACTIVE_MODULES: NavItem[] = [
  {
    key: 'master-data',
    label: 'Master data',
    path: '/master-data',
    icon: Database,
    description: 'Provinces, divisions, departments, items, vendors and warehouses.',
  },
];

/** Future modules, in roadmap order. They open an explanatory page, not a working screen. */
export const PLANNED_MODULES: NavItem[] = [
  {
    key: 'demands',
    label: 'Demands',
    path: '/modules/demands',
    icon: ClipboardList,
    plannedMilestone: 'M5',
    description: 'Register demands with multiple items and track partial fulfilment.',
  },
  {
    key: 'purchase-orders',
    label: 'Purchase orders',
    path: '/modules/purchase-orders',
    icon: Package,
    plannedMilestone: 'M6',
    description: 'Purchase orders, approved amounts, payment schedules and vendors.',
  },
  {
    key: 'stock',
    label: 'Receiving & stock',
    path: '/modules/stock',
    icon: Boxes,
    plannedMilestone: 'M7',
    description: 'Vendor receipts and warehouse stock by PO/item lot.',
  },
  {
    key: 'dispatch',
    label: 'Dispatch & Bilty',
    path: '/modules/dispatch',
    icon: Truck,
    plannedMilestone: 'M8',
    description: 'Dispatches, Bilty records and supporting documents.',
  },
  {
    key: 'finance',
    label: 'Payments & finance',
    path: '/modules/finance',
    icon: Wallet,
    plannedMilestone: 'M9',
    description: 'Vendor instalments, division receipts and 3% recovery records.',
  },
  {
    key: 'excel-sync',
    label: 'Excel sync',
    path: '/modules/excel-sync',
    icon: FileSpreadsheet,
    plannedMilestone: 'M10',
    description: 'Two-way synchronisation with the existing workbooks.',
  },
  {
    key: 'reports',
    label: 'Reports',
    path: '/modules/reports',
    icon: BarChart3,
    plannedMilestone: 'M11',
    description: 'Province, division, vendor, item, monthly and yearly reports.',
  },
];
