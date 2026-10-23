import { Route, Routes } from 'react-router';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MasterDataPage } from './pages/masterData/MasterDataPage';
import { DemandDetailPage } from './pages/demands/DemandDetailPage';
import { DemandFormPage } from './pages/demands/DemandFormPage';
import { DemandsListPage } from './pages/demands/DemandsListPage';
import { PurchaseOrderDetailPage } from './pages/purchaseOrders/PurchaseOrderDetailPage';
import { PurchaseOrderFormPage } from './pages/purchaseOrders/PurchaseOrderFormPage';
import { PurchaseOrdersListPage } from './pages/purchaseOrders/PurchaseOrdersListPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';

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
          <Route path="modules/:moduleKey" element={<ModulePlaceholderPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
