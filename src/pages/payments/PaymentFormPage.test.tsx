import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayInKarachi } from '../../contracts/demands';
import { json, mockApi, operatorSession, renderApp, viewerSession } from '../../test/mockApi';
import { payment, PAYMENT_ID } from '../../test/operationsFixtures';
import { poDetail, poListResponse, poSummary, PO_ID } from '../../test/purchaseOrderFixtures';

afterEach(() => vi.unstubAllGlobals());

const partlyPaid = () =>
  poDetail({ paidAmount: 20000, outstandingAmount: 30000, paymentStatus: 'PARTIAL' });

function routes(po = partlyPaid()) {
  return {
    'GET /api/auth/session': json(200, operatorSession),
    'GET /api/purchase-orders': poListResponse([
      poSummary(1, { id: PO_ID, outstandingAmount: 30000 }),
    ]),
    [`GET /api/purchase-orders/${PO_ID}`]: json(200, po),
  };
}

describe('Payment form', () => {
  it('is only available to the Production Operator', async () => {
    mockApi({ ...routes(), 'GET /api/auth/session': json(200, viewerSession) });
    renderApp(`/payments/new?purchaseOrderId=${PO_ID}`);
    expect(
      await screen.findByText('Only the Production Operator can record vendor payments.'),
    ).toBeInTheDocument();
  });

  it('shows approved, paid and outstanding amounts and blocks paying more than outstanding', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(routes());
    renderApp(`/payments/new?purchaseOrderId=${PO_ID}`);
    const balance = await screen.findByRole('region', { name: 'Purchase order balance' });
    expect(balance).toHaveTextContent('PKR 50,000.00');
    expect(balance).toHaveTextContent('PKR 20,000.00');
    expect(balance).toHaveTextContent('PKR 30,000.00');
    expect(balance).toHaveTextContent('Partially paid');

    await user.type(screen.getByLabelText('Amount (PKR)'), '30000.01');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(
      await screen.findByText('Amount cannot exceed the outstanding PKR 30,000.00'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Amount (PKR)')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('prefills the amount from a planned instalment and submits the payload', async () => {
    const user = userEvent.setup();
    const created = payment(1, { id: PAYMENT_ID, amount: 25000, scheduleEntryNo: 2 });
    const { calls } = mockApi({
      ...routes(),
      'POST /api/payments': json(201, created),
      [`GET /api/payments/${PAYMENT_ID}`]: json(200, created),
    });
    renderApp(`/payments/new?purchaseOrderId=${PO_ID}`);
    const schedule = await screen.findByLabelText('Planned instalment (optional)');
    expect(within(schedule).getAllByRole('option')).toHaveLength(3);
    await user.selectOptions(schedule, '2');
    expect(screen.getByLabelText('Amount (PKR)')).toHaveValue(25000);
    await user.selectOptions(screen.getByLabelText('Method'), 'CHEQUE');
    await user.type(screen.getByLabelText('Reference (cheque / transaction no.)'), 'SYN-CHQ-1');
    await user.click(screen.getByRole('button', { name: 'Add document link' }));
    await user.type(screen.getByLabelText('Document 1 name'), 'Synthetic receipt');
    await user.type(screen.getByLabelText('Document 1 link'), 'https://example.org/synthetic');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));

    expect(await screen.findByRole('heading', { name: 'PAY-000001' })).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.path === '/api/payments');
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      purchaseOrderId: PO_ID,
      paymentDate: todayInKarachi(),
      amount: 25000,
      method: 'CHEQUE',
      reference: 'SYN-CHQ-1',
      scheduleEntryNo: 2,
      notes: null,
      documents: [{ label: 'Synthetic receipt', url: 'https://example.org/synthetic' }],
    });
    expect((post?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      operatorSession.csrfToken,
    );
  });

  it('rejects document links that are not https', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(routes());
    renderApp(`/payments/new?purchaseOrderId=${PO_ID}`);
    await user.type(await screen.findByLabelText('Amount (PKR)'), '100');
    await user.click(screen.getByRole('button', { name: 'Add document link' }));
    await user.type(screen.getByLabelText('Document 1 name'), 'Synthetic');
    await user.type(screen.getByLabelText('Document 1 link'), 'http://example.org');
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText('Link must start with https://')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('says when a purchase order is fully paid', async () => {
    mockApi(routes(poDetail({ paidAmount: 50000, outstandingAmount: 0, paymentStatus: 'PAID' })));
    renderApp(`/payments/new?purchaseOrderId=${PO_ID}`);
    expect(await screen.findByText(/fully paid/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Record payment' })).not.toBeInTheDocument(),
    );
  });
});
