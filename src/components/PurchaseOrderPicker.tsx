import { listPurchaseOrders } from '../api';
import type { PurchaseOrderSummary } from '../contracts/purchaseOrders';
import { useResource } from '../hooks/useResource';
import { inputClass } from './ui';

/**
 * Selects an open purchase order. `eligible` narrows the list (e.g. orders with quantity left to
 * receive). The currently selected order stays in the list even if it is not eligible, so a
 * prefilled order is never silently dropped.
 */
export function PurchaseOrderPicker({
  id,
  value,
  onChange,
  eligible,
  emptyHint,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange(id: string): void;
  eligible(po: PurchaseOrderSummary): boolean;
  emptyHint: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const orders = useResource(
    'open-purchase-orders',
    (signal) =>
      listPurchaseOrders({ status: 'open', sort: 'poDate_desc', pageSize: 100 }, signal).then(
        (r) => r.items,
      ),
    'Open purchase orders could not be loaded.',
  );
  const list = (orders.data ?? []).filter((po) => eligible(po) || po.id === value);

  return (
    <div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={orders.loading}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`${inputClass(invalid)} mt-1`}
      >
        <option value="">{orders.loading ? 'Loading purchase orders…' : 'Select…'}</option>
        {value && !list.some((po) => po.id === value) && (
          <option value={value}>Selected purchase order</option>
        )}
        {list.map((po) => (
          <option key={po.id} value={po.id}>
            {po.poNumber} · {po.code} · {po.vendor.name}
          </option>
        ))}
      </select>
      {orders.error && <p className="mt-1 text-xs text-red-700">{orders.error}</p>}
      {orders.data && list.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">{emptyHint}</p>
      )}
    </div>
  );
}
