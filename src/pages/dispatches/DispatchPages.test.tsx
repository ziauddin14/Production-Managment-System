import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, operatorSession, renderApp, viewerSession } from '../../test/mockApi';
import { dispatchDetail, DISPATCH_ID, dispatchSummary, page } from '../../test/operationsFixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });

describe('Dispatches list', () => {
  it('lists dispatches with route, demand and Bilty number', async () => {
    mockApi({ ...session(), 'GET /api/dispatches': page([dispatchSummary(1)]) });
    renderApp('/dispatches');
    const table = await screen.findByRole('table', { name: 'Dispatches' });
    const row = within(table).getAllByRole('row')[1]!;
    expect(row).toHaveTextContent('DSP-000001');
    expect(row).toHaveTextContent('Synthetic Warehouse FEM');
    expect(row).toHaveTextContent('Synthetic Division A1');
    expect(row).toHaveTextContent('Synthetic Province A');
    expect(row).toHaveTextContent('DMD-000001');
    expect(row).toHaveTextContent('SYN-BLT-1');
    expect(screen.getByRole('link', { name: 'New dispatch' })).toBeInTheDocument();
  });
});

describe('Dispatch detail', () => {
  it('lets viewers open the challan but hides edit and cancel', async () => {
    mockApi({
      ...session(viewerSession),
      [`GET /api/dispatches/${DISPATCH_ID}`]: json(200, dispatchDetail()),
    });
    renderApp(`/dispatches/${DISPATCH_ID}`);
    expect(await screen.findByRole('heading', { name: 'DSP-000001' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Delivery challan' })).toHaveAttribute(
      'href',
      `/dispatches/${DISPATCH_ID}/challan`,
    );
    expect(screen.getByRole('link', { name: /Synthetic Bilty scan/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(screen.queryByRole('button', { name: 'Cancel dispatch' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit Bilty & transport' }),
    ).not.toBeInTheDocument();
  });

  it('updates Bilty and transport details with the record revision', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      ...session(),
      [`GET /api/dispatches/${DISPATCH_ID}`]: json(200, dispatchDetail({ biltyNo: null })),
      [`PATCH /api/dispatches/${DISPATCH_ID}`]: json(
        200,
        dispatchDetail({ biltyNo: 'SYN-BLT-9', rev: 2 }),
      ),
    });
    renderApp(`/dispatches/${DISPATCH_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Edit Bilty & transport' }));
    await user.type(screen.getByLabelText('Bilty no.'), 'SYN-BLT-9');
    await user.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('Bilty and transport details saved.')).toBeInTheDocument();
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(JSON.parse(String(patch?.init?.body))).toMatchObject({
      rev: 1,
      biltyNo: 'SYN-BLT-9',
      freightAmount: 1500,
      documents: [{ label: 'Synthetic Bilty scan', url: 'https://example.org/synthetic-bilty' }],
    });
  });

  it('cancels a dispatch after confirmation', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      ...session(),
      [`GET /api/dispatches/${DISPATCH_ID}`]: json(200, dispatchDetail()),
      [`POST /api/dispatches/${DISPATCH_ID}/cancel`]: json(
        200,
        dispatchDetail({
          status: 'CANCELLED',
          cancellation: { at: '2026-02-11T05:00:00.000Z', reason: 'Synthetic', by: null },
        }),
      ),
    });
    renderApp(`/dispatches/${DISPATCH_ID}`);
    await user.click(await screen.findByRole('button', { name: 'Cancel dispatch' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel DSP-000001?' });
    await user.type(within(dialog).getByLabelText('Reason'), 'Synthetic');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel dispatch' }));
    expect(await screen.findByText('Dispatch DSP-000001 was cancelled.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(true);
  });
});

describe('Delivery challan', () => {
  it('renders the printable challan and prints it', async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    mockApi({
      ...session(viewerSession),
      [`GET /api/dispatches/${DISPATCH_ID}`]: json(200, dispatchDetail()),
    });
    renderApp(`/dispatches/${DISPATCH_ID}/challan`);
    const challan = await screen.findByRole('article', { name: 'Delivery Challan' });
    expect(challan).toHaveTextContent('DSP-000001');
    expect(challan).toHaveTextContent('Synthetic Warehouse FEM (Warehouse)');
    expect(challan).toHaveTextContent('Synthetic Division A1, Synthetic Province A');
    expect(challan).toHaveTextContent('DMD-000001');
    expect(challan).toHaveTextContent('SYN-BLT-1');
    expect(challan).toHaveTextContent('Synthetic Transport Co');
    expect(challan).toHaveTextContent('SYN-123');
    const table = within(challan).getByRole('table', { name: 'Goods dispatched' });
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Synthetic Item One');
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('DIT/0001');
    expect(within(challan).getByText('Received by (division)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
    // The app chrome is excluded from printing.
    expect(screen.getAllByRole('banner')[0]).toHaveClass('print:hidden');
  });
});
