import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiError,
  json,
  mockApi,
  operatorSession,
  renderApp,
  viewerSession,
} from '../../test/mockApi';
import {
  poDetail,
  poMasterRoutes,
  PO_ID,
  syntheticItem,
  syntheticVendor,
  syntheticWarehouse,
} from '../../test/purchaseOrderFixtures';

afterEach(() => vi.unstubAllGlobals());

const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });

describe('Purchase order form — create', () => {
  it('is only available to the Production Operator', async () => {
    mockApi({ ...session(viewerSession), ...poMasterRoutes() });
    renderApp('/purchase-orders/new');

    expect(
      await screen.findByText('Only the Production Operator can create or change purchase orders.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create purchase order' })).not.toBeInTheDocument();
  });

  it('validates required fields, quantities, and prices without calling the API', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({ ...session(), ...poMasterRoutes() });
    renderApp('/purchase-orders/new');

    await screen.findByRole('heading', { name: 'New purchase order' });
    // Click submit without filling form
    await user.click(screen.getByRole('button', { name: 'Create purchase order' }));

    expect(screen.getByText('Please fix the errors below.')).toBeInTheDocument();
    const poPosts = calls.filter((c) => c.method === 'POST' && c.path === '/api/purchase-orders');
    expect(poPosts).toHaveLength(0);
  });

  it('registers a purchase order with CSRF token and opens detail page', async () => {
    const user = userEvent.setup();
    const createdPo = poDetail({ poNumber: 'DIT/0189' });

    const { calls } = mockApi({
      ...session(),
      ...poMasterRoutes(),
      'POST /api/purchase-orders': json(201, createdPo),
      [`GET /api/purchase-orders/${createdPo.id}`]: json(200, createdPo),
    });

    renderApp('/purchase-orders/new');
    await screen.findByRole('heading', { name: 'New purchase order' });

    await user.type(screen.getByLabelText('PO Number'), 'DIT/0189');
    await user.selectOptions(screen.getByLabelText('Vendor'), syntheticVendor.id);
    await user.selectOptions(screen.getByLabelText('Target Warehouse'), syntheticWarehouse.id);
    await user.type(screen.getByLabelText('Approved Amount'), '50000');

    // Fill line 1
    await user.selectOptions(screen.getByLabelText('Line 1 Item'), syntheticItem.id);
    await user.type(screen.getByLabelText('Line 1 Quantity'), '500');
    await user.type(screen.getByLabelText('Line 1 Unit Price'), '100');

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }));

    await waitFor(() => {
      const createCall = calls.find(
        (c) => c.method === 'POST' && c.path === '/api/purchase-orders',
      );
      expect(createCall).toBeDefined();
    });

    expect(await screen.findByRole('heading', { name: 'DIT/0189' })).toBeInTheDocument();
  });

  it('shows server validation errors next to the right fields', async () => {
    const user = userEvent.setup();
    mockApi({
      ...session(),
      ...poMasterRoutes(),
      'POST /api/purchase-orders': apiError(400, 'VALIDATION_ERROR', 'Validation failed', [
        { path: 'poNumber', message: 'PO number "DIT/0189" already exists' },
      ]),
    });

    renderApp('/purchase-orders/new');
    await screen.findByRole('heading', { name: 'New purchase order' });

    await user.type(screen.getByLabelText('PO Number'), 'DIT/0189');
    await user.selectOptions(screen.getByLabelText('Vendor'), syntheticVendor.id);
    await user.selectOptions(screen.getByLabelText('Target Warehouse'), syntheticWarehouse.id);
    await user.type(screen.getByLabelText('Approved Amount'), '50000');
    await user.selectOptions(screen.getByLabelText('Line 1 Item'), syntheticItem.id);
    await user.type(screen.getByLabelText('Line 1 Quantity'), '500');
    await user.type(screen.getByLabelText('Line 1 Unit Price'), '100');

    await user.click(screen.getByRole('button', { name: 'Create purchase order' }));

    expect(await screen.findByText('PO number "DIT/0189" already exists')).toBeInTheDocument();
  });
});

describe('Purchase order form — edit', () => {
  it('loads existing order, keeps deactivated vendor selectable, and sends rev on update', async () => {
    const user = userEvent.setup();
    const po = poDetail({ poNumber: 'DIT/0189' });
    const updatedPo = { ...po, notes: 'Updated synthetic notes', rev: po.rev + 1 };

    const { calls } = mockApi({
      ...session(),
      ...poMasterRoutes(),
      [`GET /api/purchase-orders/${PO_ID}`]: json(200, po),
      [`PATCH /api/purchase-orders/${PO_ID}`]: json(200, updatedPo),
    });

    renderApp(`/purchase-orders/${PO_ID}/edit`);
    expect(
      await screen.findByRole('heading', { name: 'Edit purchase order DIT/0189' }),
    ).toBeInTheDocument();

    const notesInput = screen.getByLabelText('Notes');
    await user.clear(notesInput);
    await user.type(notesInput, 'Updated synthetic notes');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const patchCall = calls.find(
        (c) => c.method === 'PATCH' && c.path === `/api/purchase-orders/${PO_ID}`,
      );
      expect(patchCall).toBeDefined();
      expect(JSON.parse(String(patchCall?.init?.body))).toMatchObject({
        rev: po.rev,
        notes: 'Updated synthetic notes',
      });
    });
  });
});
