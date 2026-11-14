import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, operatorSession, renderApp, viewerSession } from '../../test/mockApi';
import {
  divisionLocation,
  page,
  receiptDetail,
  receiptSummary,
  RECEIPT_ID,
} from '../../test/operationsFixtures';
import { PO_ID } from '../../test/purchaseOrderFixtures';

afterEach(() => vi.unstubAllGlobals());

const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });

describe('Receipts list', () => {
  it('lists receipts with PO, location type and quantity, and offers a new receipt', async () => {
    const { calls } = mockApi({
      ...session(),
      'GET /api/receipts': page([
        receiptSummary(1),
        receiptSummary(2, {
          deliveryRoute: 'DIRECT',
          location: divisionLocation(),
          status: 'CANCELLED',
        }),
      ]),
    });
    renderApp('/receiving');
    const table = await screen.findByRole('table', { name: 'Goods receipts' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('GRN-000001');
    expect(rows[1]).toHaveTextContent('DIT/0001');
    expect(rows[1]).toHaveTextContent('Warehouse');
    expect(rows[2]).toHaveTextContent('Division (direct delivery)');
    expect(rows[2]).toHaveTextContent('Cancelled');
    expect(within(rows[1]!).getByRole('link', { name: 'GRN-000001' })).toHaveAttribute(
      'href',
      `/receiving/${'1'.padStart(24, 'a')}`,
    );
    expect(screen.getByRole('link', { name: 'New receipt' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/api/receipts')?.search.get('status')).toBe('open');
  });

  it('applies status and search filters', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({ ...session(), 'GET /api/receipts': page([]) });
    renderApp('/receiving');
    expect(await screen.findByText('No receipts yet')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Status'), 'all');
    await user.type(screen.getByLabelText('Search receipts'), 'SYN-CH');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/api/receipts').at(-1);
      expect(last?.search.get('status')).toBe('all');
      expect(last?.search.get('search')).toBe('SYN-CH');
    });
    expect(await screen.findByText('No receipts match your filters')).toBeInTheDocument();
  });

  it('hides write actions from viewers', async () => {
    mockApi({ ...session(viewerSession), 'GET /api/receipts': page([receiptSummary(1)]) });
    renderApp('/receiving');
    await screen.findByRole('table', { name: 'Goods receipts' });
    expect(screen.queryByRole('link', { name: 'New receipt' })).not.toBeInTheDocument();
  });
});

describe('Receipt detail', () => {
  it('shows the receipt and cancels it with a reason, rev and CSRF token', async () => {
    const user = userEvent.setup();
    const r = receiptDetail();
    const { calls } = mockApi({
      ...session(),
      [`GET /api/receipts/${RECEIPT_ID}`]: json(200, r),
      [`POST /api/receipts/${RECEIPT_ID}/cancel`]: json(
        200,
        receiptDetail({
          status: 'CANCELLED',
          rev: 2,
          cancellation: { at: '2026-02-02T05:00:00.000Z', reason: 'Synthetic wrong PO', by: null },
        }),
      ),
    });
    renderApp(`/receiving/${RECEIPT_ID}`);
    expect(await screen.findByRole('heading', { name: 'GRN-000001' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DIT/0001' })).toHaveAttribute(
      'href',
      `/purchase-orders/${PO_ID}`,
    );

    await user.click(screen.getByRole('button', { name: 'Cancel receipt' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel GRN-000001?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel receipt' }));
    expect(within(dialog).getByText('Enter a reason for cancelling.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Reason'), 'Synthetic wrong PO');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel receipt' }));

    expect(await screen.findByText('Receipt GRN-000001 was cancelled.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toEqual({ rev: 1, reason: 'Synthetic wrong PO' });
    expect(screen.queryByRole('button', { name: 'Cancel receipt' })).not.toBeInTheDocument();
  });
});
