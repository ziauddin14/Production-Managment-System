import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayInKarachi } from '../../contracts/demands';
import {
  DEMAND_ID,
  demandDetail,
  demandSummary,
  syntheticDivisionA,
  syntheticDivisionB,
} from '../../test/demandFixtures';
import { json, mockApi, operatorSession, renderApp, viewerSession } from '../../test/mockApi';
import {
  dispatchDetail,
  DISPATCH_ID,
  divisionLocation,
  page,
  PO_LINE_ID,
  stockBalance,
} from '../../test/operationsFixtures';
import { masterPage, syntheticWarehouse } from '../../test/purchaseOrderFixtures';

afterEach(() => vi.unstubAllGlobals());

const DEMAND_LINE_ID = demandDetail().lines[0]!.id;

function routes(extra: Record<string, Response | (() => Response)> = {}) {
  return {
    'GET /api/auth/session': json(200, operatorSession),
    'GET /api/master/warehouses': masterPage([syntheticWarehouse]),
    'GET /api/master/divisions': masterPage([syntheticDivisionA, syntheticDivisionB]),
    'GET /api/demands': page([demandSummary(1, { id: DEMAND_ID })]),
    [`GET /api/demands/${DEMAND_ID}`]: json(200, demandDetail()),
    'GET /api/stock/balances': page([stockBalance()], { totalQuantity: 300 }),
    ...extra,
  };
}

describe('Dispatch form', () => {
  it('is only available to the Production Operator', async () => {
    mockApi({ ...routes(), 'GET /api/auth/session': json(200, viewerSession) });
    renderApp('/dispatches/new');
    expect(
      await screen.findByText('Only the Production Operator can record dispatches.'),
    ).toBeInTheDocument();
  });

  it('loads lots at the source, links demand lines and submits the full payload', async () => {
    const user = userEvent.setup();
    const created = dispatchDetail();
    const { calls } = mockApi(
      routes({
        'POST /api/dispatches': json(201, created),
        [`GET /api/dispatches/${DISPATCH_ID}`]: json(200, created),
      }),
    );
    renderApp(`/dispatches/new?demandId=${DEMAND_ID}`);

    // The demand is prefilled and its single destination is suggested.
    const demand = await screen.findByLabelText('Demand (optional)');
    expect(demand).toHaveValue(DEMAND_ID);
    await waitFor(() =>
      expect(screen.getByLabelText('Destination division')).toHaveValue(syntheticDivisionB.id),
    );

    await user.selectOptions(screen.getByLabelText('Source warehouse'), syntheticWarehouse.id);
    const lotSelect = await screen.findByLabelText('Line 1 stock lot');
    const balanceCall = calls.find((c) => c.path === '/api/stock/balances');
    expect(balanceCall?.search.get('locationKind')).toBe('WAREHOUSE');
    expect(balanceCall?.search.get('locationId')).toBe(syntheticWarehouse.id);

    await user.selectOptions(lotSelect, PO_LINE_ID);
    expect(screen.getByText('Available: 300')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Line 1 quantity'), '5');
    const demandLine = screen.getByLabelText('Line 1 demand line');
    expect(
      within(demandLine).getByRole('option', { name: /Line 1: Synthetic Item One/ }),
    ).toBeInTheDocument();
    await user.selectOptions(demandLine, DEMAND_LINE_ID);
    await user.type(screen.getByLabelText('Bilty no.'), 'SYN-BLT-1');
    await user.type(screen.getByLabelText('Freight (PKR)'), '1500');

    await user.click(screen.getByRole('button', { name: 'Record dispatch' }));
    expect(await screen.findByRole('heading', { name: 'DSP-000001' })).toBeInTheDocument();

    const post = calls.find((c) => c.method === 'POST' && c.path === '/api/dispatches');
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      dispatchDate: todayInKarachi(),
      sourceKind: 'WAREHOUSE',
      sourceId: syntheticWarehouse.id,
      destinationDivisionId: syntheticDivisionB.id,
      demandId: DEMAND_ID,
      biltyNo: 'SYN-BLT-1',
      transporterName: null,
      vehicleNo: null,
      freightAmount: 1500,
      notes: null,
      documents: [],
      lines: [{ poLineId: PO_LINE_ID, quantity: 5, demandLineId: DEMAND_LINE_ID }],
    });
    expect((post?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      operatorSession.csrfToken,
    );
  }, 20_000); // drives many controls; jsdom can exceed the 5 s default on slow machines

  it('caps quantities at the stock balance and the demand line remaining', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(routes());
    renderApp(`/dispatches/new?demandId=${DEMAND_ID}`);
    await user.selectOptions(
      await screen.findByLabelText('Source warehouse'),
      syntheticWarehouse.id,
    );
    await user.selectOptions(await screen.findByLabelText('Line 1 stock lot'), PO_LINE_ID);
    const qty = screen.getByLabelText('Line 1 quantity');
    await user.type(qty, '301');
    await user.click(screen.getByRole('button', { name: 'Record dispatch' }));
    expect(await screen.findByText('Only 300 available at this location')).toBeInTheDocument();

    await user.clear(qty);
    await user.type(qty, '11');
    await user.selectOptions(screen.getByLabelText('Line 1 demand line'), DEMAND_LINE_ID);
    await user.click(screen.getByRole('button', { name: 'Record dispatch' }));
    expect(await screen.findByText('The demand line has only 10 remaining')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('locks the destination to the source division for direct-delivery stock', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(
      routes({
        'GET /api/stock/balances': page([stockBalance({ location: divisionLocation() })], {
          totalQuantity: 300,
        }),
      }),
    );
    renderApp('/dispatches/new');
    await user.selectOptions(await screen.findByLabelText('Dispatch from'), 'DIVISION');
    await user.selectOptions(screen.getByLabelText('Source division'), syntheticDivisionA.id);
    const destination = screen.getByLabelText('Destination division');
    expect(destination).toBeDisabled();
    expect(destination).toHaveValue(syntheticDivisionA.id);
    expect(screen.getByText(/dispatched within that division/)).toBeInTheDocument();
    await screen.findByLabelText('Line 1 stock lot');
    const balanceCall = calls.find((c) => c.path === '/api/stock/balances');
    expect(balanceCall?.search.get('locationKind')).toBe('DIVISION');
  });
});
