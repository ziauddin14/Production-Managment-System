import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, operatorSession, renderApp } from '../../test/mockApi';
import {
  DISPATCH_ID,
  divisionLocation,
  page,
  stockBalance,
  stockMovement,
} from '../../test/operationsFixtures';
import { poMasterRoutes, syntheticWarehouse } from '../../test/purchaseOrderFixtures';

afterEach(() => vi.unstubAllGlobals());

const base = () => ({
  'GET /api/auth/session': json(200, operatorSession),
  ...poMasterRoutes(),
});

describe('Stock & ledger', () => {
  it('shows balances with the total and clearly labelled warehouse and division stock', async () => {
    mockApi({
      ...base(),
      'GET /api/stock/balances': page(
        [stockBalance(), stockBalance({ location: divisionLocation(), quantity: 40 })],
        { totalQuantity: 340 },
      ),
    });
    renderApp('/stock');
    const table = await screen.findByRole('table', { name: 'Stock balances' });
    expect(screen.getByRole('tab', { name: 'Balances' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Total units for these filters/)).toHaveTextContent('340');
    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Synthetic Warehouse FEM');
    expect(rows[1]).toHaveTextContent('Warehouse');
    expect(rows[1]).toHaveTextContent('DIT/0001');
    expect(rows[1]).toHaveTextContent('300');
    expect(rows[2]).toHaveTextContent('Division (direct delivery)');
  });

  it('filters balances by location type and location', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      ...base(),
      'GET /api/stock/balances': page([], { totalQuantity: 0 }),
    });
    renderApp('/stock');
    expect(await screen.findByText('No stock matches these filters')).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Location type'), 'WAREHOUSE');
    const location = screen.getByLabelText('Location');
    await waitFor(() =>
      expect(
        within(location).getByRole('option', { name: 'Synthetic Warehouse FEM' }),
      ).toBeInTheDocument(),
    );
    await user.selectOptions(location, syntheticWarehouse.id);
    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/api/stock/balances').at(-1);
      expect(last?.search.get('locationKind')).toBe('WAREHOUSE');
      expect(last?.search.get('locationId')).toBe(syntheticWarehouse.id);
    });
  });

  it('shows the ledger with signed, coloured quantities and links to the source record', async () => {
    const user = userEvent.setup();
    mockApi({
      ...base(),
      'GET /api/stock/balances': page([], { totalQuantity: 0 }),
      'GET /api/stock/movements': page([
        stockMovement(1),
        stockMovement(2, {
          type: 'DISPATCH',
          quantity: -5,
          source: { kind: 'DISPATCH', id: DISPATCH_ID, code: 'DSP-000001' },
        }),
      ]),
    });
    renderApp('/stock');
    await user.click(await screen.findByRole('tab', { name: 'Ledger' }));
    const table = await screen.findByRole('table', { name: 'Inventory ledger' });
    const rows = within(table).getAllByRole('row');
    const inCell = within(rows[1]!).getByText('+200', { exact: false });
    expect(inCell).toHaveClass('text-emerald-700');
    const outCell = within(rows[2]!).getByText('−5', { exact: false });
    expect(outCell).toHaveClass('text-red-700');
    expect(within(rows[2]!).getByRole('link', { name: 'DSP-000001' })).toHaveAttribute(
      'href',
      `/dispatches/${DISPATCH_ID}`,
    );
  });
});
