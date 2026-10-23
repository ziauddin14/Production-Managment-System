import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deferred,
  json,
  mockApi,
  operatorSession,
  renderApp,
  summaryFor,
  viewerSession,
} from '../../test/mockApi';
import { poListResponse, poMasterRoutes, poSummary } from '../../test/purchaseOrderFixtures';

afterEach(() => vi.unstubAllGlobals());

const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });

describe('Purchase orders list', () => {
  it('is an active module in navigation and navigates to the list page', async () => {
    const user = userEvent.setup();
    mockApi({
      ...session(),
      ...poMasterRoutes(),
      'GET /api/dashboard/summary': json(200, summaryFor(operatorSession)),
      'GET /api/purchase-orders': poListResponse([poSummary(1)]),
    });
    renderApp('/');
    const nav = (await screen.findAllByRole('navigation', { name: 'Main navigation' }))[0];
    if (!nav) throw new Error('navigation missing');
    const link = within(nav).getByRole('link', { name: 'Purchase orders' });
    await user.click(link);

    expect(await screen.findByRole('heading', { name: 'Purchase orders' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'DIT/0001' })).toBeInTheDocument();
  });

  it('shows loading, then rows with status, completion and a New PO action for the operator', async () => {
    const list = deferred();
    mockApi({ ...session(), ...poMasterRoutes(), 'GET /api/purchase-orders': () => list.promise });
    renderApp('/purchase-orders');
    expect(await screen.findByLabelText('Loading purchase orders')).toHaveAttribute(
      'aria-busy',
      'true',
    );

    list.resolve(
      poListResponse([
        poSummary(1, { totalQuantity: 600, approvedAmount: 50000 }),
        poSummary(2, { status: 'CANCELLED' }),
      ]),
    );

    expect(await screen.findByRole('link', { name: 'DIT/0001' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Open')).toBeInTheDocument();
    expect(within(table).getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New purchase order' })).toHaveAttribute(
      'href',
      '/purchase-orders/new',
    );
  });

  it('hides the New purchase order action from viewers', async () => {
    mockApi({
      ...session(viewerSession),
      ...poMasterRoutes(),
      'GET /api/purchase-orders': poListResponse([poSummary(1)]),
    });
    renderApp('/purchase-orders');
    expect(await screen.findByRole('link', { name: 'DIT/0001' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New purchase order' })).not.toBeInTheDocument();
  });

  it('distinguishes an empty register from empty filter results', async () => {
    const user = userEvent.setup();
    mockApi({ ...session(), ...poMasterRoutes(), 'GET /api/purchase-orders': poListResponse([]) });
    renderApp('/purchase-orders');
    expect(await screen.findByText('No purchase orders recorded yet')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search purchase orders'), 'nonexistent');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No purchase orders match your filters')).toBeInTheDocument();
  });

  it('sends search, filters and sort to the API', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      ...session(),
      ...poMasterRoutes(),
      'GET /api/purchase-orders': poListResponse([poSummary(1)]),
    });
    renderApp('/purchase-orders');
    await screen.findByRole('link', { name: 'DIT/0001' });

    await user.selectOptions(screen.getByLabelText('Delivery route'), 'DIRECT');
    const lastCall = calls[calls.length - 1]!;
    expect(lastCall.path).toBe('/api/purchase-orders');
    expect(lastCall.search.get('deliveryRoute')).toBe('DIRECT');
  });
});
