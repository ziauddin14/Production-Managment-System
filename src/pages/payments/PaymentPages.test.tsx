import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, operatorSession, renderApp, viewerSession } from '../../test/mockApi';
import { page, payment, PAYMENT_ID } from '../../test/operationsFixtures';

afterEach(() => vi.unstubAllGlobals());

describe('Payments list', () => {
  it('lists payments with formatted amounts and hides "New payment" from viewers', async () => {
    mockApi({
      'GET /api/auth/session': json(200, viewerSession),
      'GET /api/payments': page([payment(1, { amount: 12345.5 })]),
    });
    renderApp('/payments');
    const table = await screen.findByRole('table', { name: 'Vendor payments' });
    const row = within(table).getAllByRole('row')[1]!;
    expect(row).toHaveTextContent('PAY-000001');
    expect(row).toHaveTextContent('PKR 12,345.50');
    expect(row).toHaveTextContent('Bank transfer');
    expect(row).toHaveTextContent('Instalment #1');
    expect(screen.queryByRole('link', { name: 'New payment' })).not.toBeInTheDocument();
  });
});

describe('Payment detail', () => {
  it('cancels a payment with a reason', async () => {
    const user = userEvent.setup();
    const p = payment(1, { id: PAYMENT_ID });
    const { calls } = mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      [`GET /api/payments/${PAYMENT_ID}`]: json(200, p),
      [`POST /api/payments/${PAYMENT_ID}/cancel`]: json(200, {
        ...p,
        status: 'CANCELLED',
        cancellation: { at: '2026-02-16T05:00:00.000Z', reason: 'Synthetic duplicate', by: null },
      }),
    });
    renderApp(`/payments/${PAYMENT_ID}`);
    expect(await screen.findByText('PKR 20,000.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel payment' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel PAY-000001?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Synthetic duplicate');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel payment' }));
    expect(await screen.findByText('Payment PAY-000001 was cancelled.')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toEqual({ rev: 1, reason: 'Synthetic duplicate' });
  });
});
