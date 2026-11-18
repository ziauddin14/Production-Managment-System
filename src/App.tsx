import { lazy } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';

/** Module pages are loaded on first use to keep the initial bundle small. */
const MasterDataPage = lazy(() =>
  import('./pages/masterData/MasterDataPage').then((m) => ({ default: m.MasterDataPage })),
);
const DemandDetailPage = lazy(() =>
  import('./pages/demands/DemandDetailPage').then((m) => ({ default: m.DemandDetailPage })),
);
const DemandFormPage = lazy(() =>
  import('./pages/demands/DemandFormPage').then((m) => ({ default: m.DemandFormPage })),
);
const DemandsListPage = lazy(() =>
  import('./pages/demands/DemandsListPage').then((m) => ({ default: m.DemandsListPage })),
);
const PurchaseOrderDetailPage = lazy(() =>
  import('./pages/purchaseOrders/PurchaseOrderDetailPage').then((m) => ({
    default: m.PurchaseOrderDetailPage,
  })),
);
const PurchaseOrderFormPage = lazy(() =>
  import('./pages/purchaseOrders/PurchaseOrderFormPage').then((m) => ({
    default: m.PurchaseOrderFormPage,
  })),
);
const PurchaseOrdersListPage = lazy(() =>
  import('./pages/purchaseOrders/PurchaseOrdersListPage').then((m) => ({
    default: m.PurchaseOrdersListPage,
  })),
);
const ReceiptDetailPage = lazy(() =>
  import('./pages/receiving/ReceiptDetailPage').then((m) => ({ default: m.ReceiptDetailPage })),
);
const ReceiptFormPage = lazy(() =>
  import('./pages/receiving/ReceiptFormPage').then((m) => ({ default: m.ReceiptFormPage })),
);
const ReceiptsListPage = lazy(() =>
  import('./pages/receiving/ReceiptsListPage').then((m) => ({ default: m.ReceiptsListPage })),
);
const StockPage = lazy(() =>
  import('./pages/stock/StockPage').then((m) => ({ default: m.StockPage })),
);
const OpeningStockFormPage = lazy(() =>
  import('./pages/stock/OpeningStockFormPage').then((m) => ({ default: m.OpeningStockFormPage })),
);
const OpeningStockDetailPage = lazy(() =>
  import('./pages/stock/OpeningStockDetailPage').then((m) => ({
    default: m.OpeningStockDetailPage,
  })),
);
const DeliveryChallanPage = lazy(() =>
  import('./pages/dispatches/DeliveryChallanPage').then((m) => ({
    default: m.DeliveryChallanPage,
  })),
);
const DispatchDetailPage = lazy(() =>
  import('./pages/dispatches/DispatchDetailPage').then((m) => ({ default: m.DispatchDetailPage })),
);
const DispatchFormPage = lazy(() =>
  import('./pages/dispatches/DispatchFormPage').then((m) => ({ default: m.DispatchFormPage })),
);
const DispatchesListPage = lazy(() =>
  import('./pages/dispatches/DispatchesListPage').then((m) => ({ default: m.DispatchesListPage })),
);
const PaymentDetailPage = lazy(() =>
  import('./pages/payments/PaymentDetailPage').then((m) => ({ default: m.PaymentDetailPage })),
);
const PaymentFormPage = lazy(() =>
  import('./pages/payments/PaymentFormPage').then((m) => ({ default: m.PaymentFormPage })),
);
const PaymentsListPage = lazy(() =>
  import('./pages/payments/PaymentsListPage').then((m) => ({ default: m.PaymentsListPage })),
);
const SyncStatusPage = lazy(() =>
  import('./pages/sync/SyncStatusPage').then((m) => ({ default: m.SyncStatusPage })),
);
const ReportsPage = lazy(() =>
  import('./pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);

/** Old "planned module" links (`/modules/:key`) now open the module itself. */
const LEGACY_MODULE_PATHS: Record<string, string> = {
  stock: '/stock',
  dispatch: '/dispatches',
  finance: '/payments',
  'excel-sync': '/sync',
  reports: '/reports',
};

function LegacyModuleRedirect() {
  const { moduleKey = '' } = useParams();
  const path = LEGACY_MODULE_PATHS[moduleKey];
  return path ? <Navigate to={path} replace /> : <NotFoundPage />;
}

/** Application routes. Rendered inside a router (BrowserRouter in main.tsx, MemoryRouter in tests). */
export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="master-data" element={<MasterDataPage />} />
          <Route path="master-data/:entity" element={<MasterDataPage />} />
          <Route path="demands" element={<DemandsListPage />} />
          <Route path="demands/new" element={<DemandFormPage />} />
          <Route path="demands/:id" element={<DemandDetailPage />} />
          <Route path="demands/:id/edit" element={<DemandFormPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersListPage />} />
          <Route path="purchase-orders/new" element={<PurchaseOrderFormPage />} />
          <Route path="purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="purchase-orders/:id/edit" element={<PurchaseOrderFormPage />} />
          <Route path="receiving" element={<ReceiptsListPage />} />
          <Route path="receiving/new" element={<ReceiptFormPage />} />
          <Route path="receiving/:id" element={<ReceiptDetailPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="stock/opening/new" element={<OpeningStockFormPage />} />
          <Route path="stock/opening/:id" element={<OpeningStockDetailPage />} />
          <Route path="dispatches" element={<DispatchesListPage />} />
          <Route path="dispatches/new" element={<DispatchFormPage />} />
          <Route path="dispatches/:id" element={<DispatchDetailPage />} />
          <Route path="dispatches/:id/challan" element={<DeliveryChallanPage />} />
          <Route path="payments" element={<PaymentsListPage />} />
          <Route path="payments/new" element={<PaymentFormPage />} />
          <Route path="payments/:id" element={<PaymentDetailPage />} />
          <Route path="sync" element={<SyncStatusPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="modules/:moduleKey" element={<LegacyModuleRedirect />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
