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
