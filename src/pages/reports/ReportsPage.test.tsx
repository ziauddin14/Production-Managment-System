import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayInKarachi } from '../../contracts/demands';
import { json, mockApi, operatorSession, renderApp } from '../../test/mockApi';
import { report } from '../../test/operationsFixtures';
import { masterPage, poMasterRoutes, syntheticVendor } from '../../test/purchaseOrderFixtures';

const createObjectURL = vi.fn(() => 'blob:synthetic');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function routes() {
  return {
    'GET /api/auth/session': json(200, operatorSession),
    ...poMasterRoutes(),
    'GET /api/master/provinces': masterPage([]),
    'GET /api/reports/stock': (_init: RequestInit | undefined, url: URL) =>
      url.searchParams.get('format') === 'csv'
        ? new Response('Item,Quantity\nSynthetic Item One,1200\n', {
            status: 200,
            headers: { 'Content-Type': 'text/csv' },
          })
        : json(200, report()),
  };
}

describe('Reports', () => {
  it('runs the chosen report with filters and renders typed columns and totals', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(routes());
    renderApp('/reports');
    expect(await screen.findByText('No report shown yet')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Report'), 'stock');
    await waitFor(() =>
      expect(
        within(screen.getByLabelText('Vendor')).getByRole('option', {
          name: 'Synthetic Vendor One',
        }),
      ).toBeInTheDocument(),
    );
    await user.selectOptions(screen.getByLabelText('Vendor'), syntheticVendor.id);
    await user.type(screen.getByLabelText('From date'), '2026-01-01');
    await user.click(screen.getByRole('button', { name: 'Show report' }));

    const table = await screen.findByRole('table', { name: 'Synthetic stock report' });
    const call = calls.find((c) => c.path === '/api/reports/stock');
    expect(call?.search.get('format')).toBe('json');
    expect(call?.search.get('vendorId')).toBe(syntheticVendor.id);
    expect(call?.search.get('from')).toBe('2026-01-01');

    const rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Synthetic Item One');
    expect(rows[1]).toHaveTextContent('1,200');
    expect(rows[1]).toHaveTextContent('PKR 120,000.00');
    expect(rows[2]).toHaveTextContent('PKR 1,500.50');
    const totals = rows.at(-1)!;
    expect(totals).toHaveTextContent('Total');
    expect(totals).toHaveTextContent('1,230');
    expect(totals).toHaveTextContent('PKR 121,500.50');
    const money = within(rows[1]!).getByText('PKR 120,000.00');
    expect(money).toHaveClass('text-right');
  });

  it('warns when the report was truncated', async () => {
    const user = userEvent.setup();
    mockApi({ ...routes(), 'GET /api/reports/stock': json(200, report({ truncated: true })) });
    renderApp('/reports');
    await user.selectOptions(await screen.findByLabelText('Report'), 'stock');
    await user.click(screen.getByRole('button', { name: 'Show report' }));
    expect(await screen.findByText(/cut off at the row limit/)).toBeInTheDocument();
  });

  it('downloads the CSV with the session cookie and saves it with a dated file name', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { calls, fetchMock } = mockApi(routes());
    renderApp('/reports');
    await user.selectOptions(await screen.findByLabelText('Report'), 'stock');
    await user.click(screen.getByLabelText('Include cancelled records'));
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const csvCall = calls.find((c) => c.path === '/api/reports/stock');
    expect(csvCall?.search.get('format')).toBe('csv');
    expect(csvCall?.search.get('includeCancelled')).toBe('true');
    expect(csvCall?.init?.credentials).toBe('include');
    expect(fetchMock).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe(`stock-${todayInKarachi()}.csv`);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
  });

  it('prints the shown report', async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    mockApi(routes());
    renderApp('/reports');
    await user.selectOptions(await screen.findByLabelText('Report'), 'stock');
    expect(screen.getByRole('button', { name: 'Print' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Show report' }));
    await screen.findByRole('table', { name: 'Synthetic stock report' });
    await user.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
