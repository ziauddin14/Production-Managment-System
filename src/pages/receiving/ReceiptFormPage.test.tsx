import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayInKarachi } from '../../contracts/demands';
import {
  apiError,
  json,
  mockApi,
  operatorSession,
  renderApp,
  viewerSession,
} from '../../test/mockApi';
import { PO_LINE_ID, receiptDetail, RECEIPT_ID } from '../../test/operationsFixtures';
import {
  poDetail,
  poListResponse,
  poSummary,
  PO_ID,
  syntheticDivision,
  poRef,
} from '../../test/purchaseOrderFixtures';

afterEach(() => vi.unstubAllGlobals());

const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });

const partlyReceived = () =>
  poDetail({
    totalReceived: 200,
    completion: 'PARTIAL',
    lines: [
      {
        ...poDetail().lines[0]!,
        quantityReceived: 200,
        quantityRemaining: 300,
        completion: 'PARTIAL',
      },
    ],
  });

function routes(po = partlyReceived()) {
  return {
    ...session(),
    'GET /api/purchase-orders': poListResponse([poSummary(1, { id: PO_ID })]),
    [`GET /api/purchase-orders/${PO_ID}`]: json(200, po),
  };
}

describe('Receipt form', () => {
  it('is only available to the Production Operator', async () => {
    mockApi({ ...session(viewerSession) });
    renderApp(`/receiving/new?purchaseOrderId=${PO_ID}`);
    expect(
      await screen.findByText('Only the Production Operator can record receipts.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record receipt' })).not.toBeInTheDocument();
  });

  it('prefills the PO from the URL, shows remaining quantities and blocks over-receiving', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(routes());
    renderApp(`/receiving/new?purchaseOrderId=${PO_ID}`);

    const qty = await screen.findByLabelText('Line 1 quantity to receive');
    const table = screen.getByRole('table', { name: 'Purchase order lines' });
    const row = within(table).getAllByRole('row')[1]!;
    expect(row).toHaveTextContent('500');
    expect(row).toHaveTextContent('200');
    expect(row).toHaveTextContent('300');
    expect(screen.getByText('Received into warehouse')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Warehouse FEM')).toBeInTheDocument();
    expect(screen.getByLabelText('Receipt date')).toHaveValue(todayInKarachi());

    await user.type(qty, '301');
    await user.click(screen.getByRole('button', { name: 'Record receipt' }));
    expect(
      await screen.findByText('Cannot receive more than the remaining 300'),
    ).toBeInTheDocument();
    expect(qty).toHaveAttribute('aria-invalid', 'true');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('requires at least one quantity and a receipt date not before the PO date', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(routes());
    renderApp(`/receiving/new?purchaseOrderId=${PO_ID}`);
    const date = await screen.findByLabelText('Receipt date');
    await user.clear(date);
    await user.type(date, '2026-01-01');
    await user.click(screen.getByRole('button', { name: 'Record receipt' }));
    expect(await screen.findByText(/cannot be before the PO date/)).toBeInTheDocument();
    expect(screen.getByText('Enter a quantity for at least one line')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('submits the receipt with the CSRF token and opens the new receipt', async () => {
    const user = userEvent.setup();
    const created = receiptDetail();
    const { calls } = mockApi({
      ...routes(),
      'POST /api/receipts': json(201, created),
      [`GET /api/receipts/${RECEIPT_ID}`]: json(200, created),
    });
    renderApp(`/receiving/new?purchaseOrderId=${PO_ID}`);

    await user.type(await screen.findByLabelText('Line 1 quantity to receive'), '200');
    await user.type(screen.getByLabelText('Vendor challan no.'), '  SYN-CH-1 ');
    await user.click(screen.getByRole('button', { name: 'Record receipt' }));

    expect(await screen.findByRole('heading', { name: 'GRN-000001' })).toBeInTheDocument();
    expect(screen.getByText('Receipt GRN-000001 recorded.')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.path === '/api/receipts');
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      purchaseOrderId: PO_ID,
      receiptDate: todayInKarachi(),
      vendorChallanNo: 'SYN-CH-1',
      notes: null,
      documents: [],
      lines: [{ poLineId: PO_LINE_ID, quantity: 200 }],
    });
    const headers = post?.init?.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe(operatorSession.csrfToken);
  });

  it('shows server validation details next to the line', async () => {
    const user = userEvent.setup();
    mockApi({
      ...routes(),
      'POST /api/receipts': apiError(422, 'VALIDATION_ERROR', 'Some entries are not valid', [
        { path: 'lines.0.quantity', message: 'Synthetic: exceeds remaining quantity' },
      ]),
    });
    renderApp(`/receiving/new?purchaseOrderId=${PO_ID}`);
    await user.type(await screen.findByLabelText('Line 1 quantity to receive'), '10');
    await user.click(screen.getByRole('button', { name: 'Record receipt' }));
    expect(await screen.findByText('Synthetic: exceeds remaining quantity')).toBeInTheDocument();
    expect(screen.getByLabelText('Line 1 quantity to receive')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('explains that direct deliveries are recorded at the division, not as warehouse stock', async () => {
    mockApi(
      routes(
        poDetail({
          deliveryRoute: 'DIRECT',
          targetWarehouse: null,
          destinationDivision: {
            ...poRef(syntheticDivision),
            provinceName: 'Synthetic Province A',
          },
        }),
      ),
    );
    renderApp(`/receiving/new?purchaseOrderId=${PO_ID}`);
    expect(await screen.findByText('Delivered to division')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Division A1, Synthetic Province A')).toBeInTheDocument();
    expect(screen.getByText(/not warehouse stock/)).toBeInTheDocument();
  });

  it('lets the operator choose an open PO when none is prefilled', async () => {
    const user = userEvent.setup();
    mockApi(routes());
    renderApp('/receiving/new');
    const picker = await screen.findByLabelText('Purchase order');
    await waitFor(() => expect(picker).toBeEnabled());
    await user.selectOptions(picker, PO_ID);
    expect(await screen.findByLabelText('Line 1 quantity to receive')).toBeInTheDocument();
  });
});
