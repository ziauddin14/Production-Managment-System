import {
  BarChart3,
  Boxes,
  ClipboardList,
  Database,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  PackageCheck,
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
  {
    key: 'demands',
    label: 'Demands',
    path: '/demands',
    icon: ClipboardList,
    description: 'Register demands with multiple items and track partial fulfilment.',
  },
  {
    key: 'purchase-orders',
    label: 'Purchase orders',
    path: '/purchase-orders',
    icon: Package,
    description: 'Purchase orders, approved amounts, payment schedules and vendors.',
  },
  {
    key: 'receiving',
    label: 'Receiving',
    path: '/receiving',
    icon: PackageCheck,
    description: 'Goods received from vendors against purchase orders.',
  },
  {
    key: 'stock',
    label: 'Stock & ledger',
    path: '/stock',
    icon: Boxes,
    description: 'Stock balances by location and PO/item lot, and the inventory ledger.',
  },
  {
    key: 'dispatch',
    label: 'Dispatch & Bilty',
    path: '/dispatches',
    icon: Truck,
    description: 'Dispatches to divisions, Bilty records, documents and delivery challans.',
  },
  {
    key: 'finance',
    label: 'Vendor payments',
    path: '/payments',
    icon: Wallet,
    description: 'Payments to vendors against purchase orders and their schedules.',
  },
  {
    key: 'excel-sync',
    label: 'Excel sync',
    path: '/sync',
    icon: FileSpreadsheet,
    description: 'Status of the queue that keeps the Excel workbooks in step with PMS.',
  },
  {
    key: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: BarChart3,
    description: 'Purchase order, receipt, stock, dispatch, payment, demand and vendor reports.',
  },
];

/**
 * Future modules, in roadmap order. They open an explanatory page, not a working screen.
 * Every module of the current roadmap (M4–M11) is built, so the list is empty.
 */
export const PLANNED_MODULES: NavItem[] = [];
