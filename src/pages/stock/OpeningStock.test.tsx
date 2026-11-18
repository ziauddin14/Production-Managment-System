import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OpeningStockDetail } from '../../contracts/operations';
import { json, mockApi, operatorSession, renderApp, viewerSession } from '../../test/mockApi';
import { page, stockBalance } from '../../test/operationsFixtures';
import {
  poMasterRoutes,
  poRef,
  syntheticItem,
  syntheticItemTwo,
  syntheticWarehouse,
} from '../../test/purchaseOrderFixtures';

afterEach(() => vi.unstubAllGlobals());

const ENTRY_ID = '9'.repeat(24);

function openingDetail(overrides: Partial<OpeningStockDetail> = {}): OpeningStockDetail {
  return {
    id: ENTRY_ID,
    code: 'OPN-000001',
    entryDate: '2026-01-10',
    status: 'ACTIVE',
    warehouse: poRef(syntheticWarehouse),
    reference: 'Synthetic old PO',
    totalQuantity: 70,
    lineCount: 2,
    rev: 1,
    createdAt: '2026-01-10T05:00:00.000Z',
    createdBy: 'synthetic.operator',
    notes: 'Counted\nby hand',
    lines: [
      { id: 'a'.repeat(24), lineNo: 1, item: poRef(syntheticItem), quantity: 50 },
      { id: 'b'.repeat(24), lineNo: 2, item: poRef(syntheticItemTwo), quantity: 20 },
    ],
    cancellation: null,
    ...overrides,
  };
}

describe('Opening stock', () => {
  it('shows the Add opening stock action to the operator and lists entries', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      ...poMasterRoutes(),
      'GET /api/stock/balances': page([], { totalQuantity: 0 }),
      'GET /api/stock/opening': page([openingDetail()]),
    });
    renderApp('/stock');
    expect(await screen.findByRole('link', { name: 'Add opening stock' })).toHaveAttribute(
      'href',
      '/stock/opening/new',
    );
    await user.click(screen.getByRole('tab', { name: 'Opening stock' }));
    const table = await screen.findByRole('table', { name: 'Opening stock entries' });
    expect(within(table).getByRole('link', { name: 'OPN-000001' })).toHaveAttribute(
      'href',
      `/stock/opening/${ENTRY_ID}`,
    );
    expect(within(table).getByText('Synthetic old PO')).toBeInTheDocument();
  });

  it('hides the action from viewers', async () => {
    mockApi({
      'GET /api/auth/session': json(200, viewerSession),
      ...poMasterRoutes(),
      'GET /api/stock/balances': page([], { totalQuantity: 0 }),
    });
    renderApp('/stock');
    expect(await screen.findByRole('tab', { name: 'Balances' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add opening stock' })).not.toBeInTheDocument();
  });

  it('links an opening-stock lot to its entry instead of a purchase order', async () => {
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      ...poMasterRoutes(),
      'GET /api/stock/balances': page(
        [
          stockBalance({
            lot: {
              purchaseOrderId: ENTRY_ID,
              purchaseOrderCode: 'OPN-000001',
              poNumber: 'Opening stock',
              poLineId: 'a'.repeat(24),
              poLineNo: 1,
            },
          }),
        ],
        { totalQuantity: 300 },
      ),
    });
    renderApp('/stock');
    expect(await screen.findByRole('link', { name: 'Opening stock' })).toHaveAttribute(
      'href',
      `/stock/opening/${ENTRY_ID}`,
    );
  });

  it('validates and submits a new entry, then shows it', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      ...poMasterRoutes(),
      'POST /api/stock/opening': json(201, openingDetail()),
      [`GET /api/stock/opening/${ENTRY_ID}`]: json(200, openingDetail()),
    });
    renderApp('/stock/opening/new');
    const warehouse = await screen.findByLabelText('Warehouse');
    await user.click(screen.getByRole('button', { name: 'Add to stock' }));
    expect(await screen.findByText('Choose an item for this line')).toBeInTheDocument();
    expect(screen.getByText('Enter a whole number of at least 1')).toBeInTheDocument();

    await user.selectOptions(warehouse, syntheticWarehouse.id);
    await user.selectOptions(screen.getByLabelText('Item 1'), syntheticItem.id);
    await user.type(screen.getByLabelText('Quantity'), '50');
    await user.type(screen.getByLabelText('Notes'), 'Counted{enter}by hand');
    await user.click(screen.getByRole('button', { name: 'Add to stock' }));

    expect(await screen.findByRole('heading', { name: 'OPN-000001' })).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST' && c.path === '/api/stock/opening');
    const body = JSON.parse(String(post?.init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      warehouseId: syntheticWarehouse.id,
      notes: 'Counted\nby hand',
      lines: [{ itemId: syntheticItem.id, quantity: 50 }],
    });
    await waitFor(() => expect(screen.getByText(/added to the warehouse/)).toBeInTheDocument());
  });
});
