import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deferred,
  json,
  mockApi,
  operatorSession,
  renderApp,
  viewerSession,
} from '../../test/mockApi';
import { poDetail, poMasterRoutes, PO_ID } from '../../test/purchaseOrderFixtures';
import { page, payment, receiptSummary } from '../../test/operationsFixtures';

afterEach(() => vi.unstubAllGlobals());

const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });

describe('Purchase order detail', () => {
  it('shows loading, then header details, lines, schedule, and invoice for operator', async () => {
    const detail = deferred();
    mockApi({
      ...session(),
      ...poMasterRoutes(),
      [`GET /api/purchase-orders/${PO_ID}`]: () => detail.promise,
    });
    renderApp(`/purchase-orders/${PO_ID}`);
    expect(await screen.findByLabelText('Loading purchase order details')).toHaveAttribute(
      'aria-busy',
      'true',
    );

    detail.resolve(json(200, poDetail()));

    expect(await screen.findByRole('heading', { name: 'DIT/0001' })).toBeInTheDocument();
    expect(screen.getByText('PO-000001')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Vendor One')).toBeInTheDocument();
    expect(screen.getByText('Warehouse route')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Warehouse FEM')).toBeInTheDocument();
    expect(screen.getAllByText('PKR 50,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Item One')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/purchase-orders/${PO_ID}/edit`,
    );
    expect(screen.getByRole('button', { name: 'Cancel PO' })).toBeInTheDocument();
  });

  it('gives viewers read-only access with no write or cancel actions', async () => {
    mockApi({
      ...session(viewerSession),
      ...poMasterRoutes(),
      [`GET /api/purchase-orders/${PO_ID}`]: json(200, poDetail()),
    });
    renderApp(`/purchase-orders/${PO_ID}`);

    expect(await screen.findByRole('heading', { name: 'DIT/0001' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel PO' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Record receipt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Record payment' })).not.toBeInTheDocument();
  });

  it('shows received quantities, payment balance, receipts, payments and record actions', async () => {
    const line = poDetail().lines[0]!;
    const po = poDetail({
      completion: 'PARTIAL',
      totalReceived: 200,
      paidAmount: 20000,
      outstandingAmount: 30000,
      paymentStatus: 'PARTIAL',
      lines: [{ ...line, quantityReceived: 200, quantityRemaining: 300, completion: 'PARTIAL' }],
    });
    const { calls } = mockApi({
      ...session(),
      [`GET /api/purchase-orders/${PO_ID}`]: json(200, po),
      'GET /api/receipts': page([receiptSummary(1)]),
      'GET /api/payments': page([payment(1)]),
    });
    renderApp(`/purchase-orders/${PO_ID}`);

    expect(await screen.findByRole('heading', { name: 'DIT/0001' })).toBeInTheDocument();
    expect(screen.getByText('Partially paid')).toBeInTheDocument();
    expect(screen.getByText('PKR 30,000.00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Record receipt' })).toHaveAttribute(
      'href',
      `/receiving/new?purchaseOrderId=${PO_ID}`,
    );
    expect(screen.getByRole('link', { name: 'Record payment' })).toHaveAttribute(
      'href',
      `/payments/new?purchaseOrderId=${PO_ID}`,
    );

    const receipts = screen.getByRole('region', { name: 'Receipts' });
    expect(await within(receipts).findByRole('link', { name: 'GRN-000001' })).toBeInTheDocument();
    const payments = screen.getByRole('region', { name: 'Payments' });
    expect(await within(payments).findByRole('link', { name: 'PAY-000001' })).toBeInTheDocument();
    expect(within(payments).getByText('PKR 20,000.00')).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/receipts')?.search.get('purchaseOrderId')).toBe(
      PO_ID,
    );
    expect(calls.find((c) => c.path === '/api/payments')?.search.get('purchaseOrderId')).toBe(
      PO_ID,
    );
  });

  it('offers no receipt or payment action once the PO is fully received and paid', async () => {
    const line = poDetail().lines[0]!;
    mockApi({
      ...session(),
      [`GET /api/purchase-orders/${PO_ID}`]: json(
        200,
        poDetail({
          completion: 'COMPLETE',
          totalReceived: 500,
          paidAmount: 50000,
          outstandingAmount: 0,
          paymentStatus: 'PAID',
          lines: [{ ...line, quantityReceived: 500, quantityRemaining: 0, completion: 'COMPLETE' }],
        }),
      ),
      'GET /api/receipts': page([]),
      'GET /api/payments': page([]),
    });
    renderApp(`/purchase-orders/${PO_ID}`);
    expect(await screen.findByRole('heading', { name: 'DIT/0001' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Record receipt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Record payment' })).not.toBeInTheDocument();
    expect(
      await screen.findByText('No goods have been received against this purchase order yet.'),
    ).toBeInTheDocument();
  });

  it('cancels with a required reason, rev and CSRF token', async () => {
    const user = userEvent.setup();
    const po = poDetail();
    const cancelled = poDetail({
      status: 'CANCELLED',
      cancellation: {
        at: '2026-01-20T10:00:00.000Z',
        reason: 'Synthetic supplier out of stock',
        by: 'synthetic.operator',
      },
    });

    const { calls } = mockApi({
      ...session(),
      ...poMasterRoutes(),
      [`GET /api/purchase-orders/${PO_ID}`]: json(200, po),
      [`POST /api/purchase-orders/${PO_ID}/cancel`]: json(200, cancelled),
    });

    renderApp(`/purchase-orders/${PO_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Cancel PO' }));

    const modal = screen.getByRole('dialog', { name: 'Cancel Purchase Order' });
    expect(modal).toBeInTheDocument();

    const reasonInput = within(modal).getByPlaceholderText(/Explain why this purchase order/);
    await user.type(reasonInput, 'Synthetic supplier out of stock');
    await user.click(within(modal).getByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(await screen.findByText(/This purchase order was cancelled on/)).toBeInTheDocument();
    expect(screen.getByText('Synthetic supplier out of stock')).toBeInTheDocument();

    const cancelCall = calls.find(
      (c) => c.method === 'POST' && c.path === `/api/purchase-orders/${PO_ID}/cancel`,
    );
    expect(cancelCall).toBeDefined();
    expect(JSON.parse(String(cancelCall?.init?.body))).toEqual({
      rev: po.rev,
      reason: 'Synthetic supplier out of stock',
    });
  });
});
