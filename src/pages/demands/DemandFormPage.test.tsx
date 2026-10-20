import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { todayInKarachi } from '../../contracts/demands';
import {
  apiError,
  deferred,
  json,
  mockApi,
  operatorSession,
  renderApp,
  viewerSession,
} from '../../test/mockApi';
import {
  DEMAND_ID,
  demandDetail,
  masterPage,
  masterRoutes,
  ref,
  syntheticDepartment,
  syntheticDivisionA,
  syntheticDivisionB,
  syntheticItem,
  syntheticItemTwo,
  syntheticProvinceA,
} from '../../test/demandFixtures';

afterEach(() => vi.unstubAllGlobals());

// These tests drive many form controls; jsdom needs more than the 5 s default on slow machines.
const LONG = 20_000;
const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });
const line = (n: number) => screen.getByRole('listitem', { name: `Item line ${n}` });

async function fillHeader(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('option', { name: syntheticDepartment.name });
  await user.selectOptions(screen.getByLabelText('Department'), syntheticDepartment.id);
  await user.selectOptions(screen.getByLabelText('Requesting province'), syntheticProvinceA.id);
}

async function fillLine(
  user: ReturnType<typeof userEvent.setup>,
  n: number,
  itemId: string,
  destinationId: string,
  quantity: string,
) {
  const row = line(n);
  await user.selectOptions(within(row).getByLabelText('Item'), itemId);
  await user.selectOptions(within(row).getByLabelText('Destination division'), destinationId);
  await user.clear(within(row).getByLabelText('Quantity'));
  await user.type(within(row).getByLabelText('Quantity'), quantity);
}

describe('Demand form — create', () => {
  it('is only available to the Production Operator', async () => {
    mockApi({ ...session(viewerSession), ...masterRoutes() });
    renderApp('/demands/new');
    expect(
      await screen.findByText('Only the Production Operator can register or change demands.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Register demand' })).not.toBeInTheDocument();
  });

  it('shows a loading state, then an error if master data cannot be loaded', async () => {
    const departments = deferred();
    mockApi({
      ...session(),
      ...masterRoutes(),
      'GET /api/master/departments': () => departments.promise,
    });
    renderApp('/demands/new');
    expect(await screen.findByLabelText('Loading form')).toHaveAttribute('aria-busy', 'true');
    departments.resolve(apiError(500, 'INTERNAL', 'Something went wrong on the server.'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on the server.',
    );
  });

  it(
    'validates required fields, quantities, future dates and duplicate lines without calling the API',
    async () => {
      const user = userEvent.setup();
      const { calls } = mockApi({ ...session(), ...masterRoutes() });
      renderApp('/demands/new');
      expect(await screen.findByRole('heading', { name: 'New demand' })).toBeInTheDocument();
      expect(screen.getByLabelText('Demand date')).toHaveValue(todayInKarachi());

      await user.click(screen.getByRole('button', { name: 'Register demand' }));
      expect(await screen.findByText('Please correct the highlighted fields.')).toBeInTheDocument();
      expect(screen.getByText('Choose a department.')).toBeInTheDocument();
      expect(screen.getByText('Choose a province.')).toBeInTheDocument();
      expect(within(line(1)).getByText('Choose an item.')).toBeInTheDocument();
      expect(within(line(1)).getByText('Choose a destination.')).toBeInTheDocument();
      expect(within(line(1)).getByText('Enter a whole number of at least 1.')).toBeInTheDocument();
      expect(screen.getByLabelText('Department')).toHaveAttribute('aria-invalid', 'true');

      fireEvent.change(screen.getByLabelText('Demand date'), { target: { value: '2999-01-01' } });
      await fillHeader(user);
      await fillLine(user, 1, syntheticItem.id, syntheticDivisionB.id, '0');
      await user.click(screen.getByRole('button', { name: 'Add item' }));
      await fillLine(user, 2, syntheticItem.id, syntheticDivisionB.id, '2.5');
      await user.click(screen.getByRole('button', { name: 'Register demand' }));

      expect(await screen.findByText('Date cannot be in the future.')).toBeInTheDocument();
      expect(within(line(1)).getByText('Enter a whole number of at least 1.')).toBeInTheDocument();
      expect(within(line(2)).getByText('Enter a whole number of at least 1.')).toBeInTheDocument();
      expect(within(line(2)).getByText(/Same item and destination as line 1/)).toBeInTheDocument();
      expect(calls.filter((c) => c.method !== 'GET')).toHaveLength(0);
    },
    LONG,
  );

  it('only offers requesting divisions of the chosen province', async () => {
    const user = userEvent.setup();
    mockApi({ ...session(), ...masterRoutes() });
    renderApp('/demands/new');
    await screen.findByRole('heading', { name: 'New demand' });
    const division = screen.getByLabelText('Requesting division (optional)');
    expect(division).toBeDisabled();

    await fillHeader(user);
    expect(division).toBeEnabled();
    const names = within(division)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names).toEqual(['None', syntheticDivisionA.name]);
  });

  it(
    'registers a demand with the CSRF token and opens it with a success notice',
    async () => {
      const user = userEvent.setup();
      const created = demandDetail({ lineCount: 2 });
      const { calls } = mockApi({
        ...session(),
        ...masterRoutes(),
        'POST /api/demands': json(201, created),
        [`GET /api/demands/${DEMAND_ID}`]: json(200, created),
      });
      renderApp('/demands/new');
      await fillHeader(user);
      await user.selectOptions(
        screen.getByLabelText('Requesting division (optional)'),
        syntheticDivisionA.id,
      );
      await user.type(
        screen.getByLabelText('Source reference (e-mail subject, optional)'),
        '  Synthetic subject  ',
      );
      await fillLine(user, 1, syntheticItem.id, syntheticDivisionB.id, '12');
      await user.type(
        within(line(1)).getByLabelText('Receiver name (optional)'),
        'Synthetic Receiver',
      );
      await user.click(screen.getByRole('button', { name: 'Add item' }));
      await fillLine(user, 2, syntheticItemTwo.id, syntheticDivisionB.id, '3');
      await user.click(screen.getByRole('button', { name: 'Register demand' }));

      expect(await screen.findByText('Registered demand DMD-000001.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'DMD-000001' })).toBeInTheDocument();
      const post = calls.find((c) => c.method === 'POST');
      expect((post?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
        operatorSession.csrfToken,
      );
      expect(JSON.parse(String(post?.init?.body))).toEqual({
        demandDate: todayInKarachi(),
        departmentId: syntheticDepartment.id,
        provinceId: syntheticProvinceA.id,
        divisionId: syntheticDivisionA.id,
        sourceReference: 'Synthetic subject',
        lines: [
          {
            itemId: syntheticItem.id,
            destinationDivisionId: syntheticDivisionB.id,
            quantity: 12,
            receiverName: 'Synthetic Receiver',
            receiverPhone: null,
          },
          {
            itemId: syntheticItemTwo.id,
            destinationDivisionId: syntheticDivisionB.id,
            quantity: 3,
            receiverName: null,
            receiverPhone: null,
          },
        ],
      });
    },
    LONG,
  );

  it(
    'shows server validation errors next to the right fields',
    async () => {
      const user = userEvent.setup();
      mockApi({
        ...session(),
        ...masterRoutes(),
        'POST /api/demands': json(400, {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Some fields are invalid.',
            details: [
              {
                path: 'lines.0.itemId',
                message: 'This item is inactive. Choose an active record.',
              },
              { path: 'lines.0.receiverPhone', message: 'Enter a valid phone number.' },
            ],
          },
        }),
      });
      renderApp('/demands/new');
      await fillHeader(user);
      await fillLine(user, 1, syntheticItem.id, syntheticDivisionB.id, '5');
      await user.click(screen.getByRole('button', { name: 'Register demand' }));

      expect(
        await screen.findByText('The server rejected some fields. Please correct them.'),
      ).toBeInTheDocument();
      expect(
        within(line(1)).getByText('This item is inactive. Choose an active record.'),
      ).toBeInTheDocument();
      expect(within(line(1)).getByText('Enter a valid phone number.')).toBeInTheDocument();
      expect(within(line(1)).getByLabelText('Item')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('button', { name: 'Register demand' })).toBeEnabled();
    },
    LONG,
  );

  it('removes a line but never the last one', async () => {
    const user = userEvent.setup();
    mockApi({ ...session(), ...masterRoutes() });
    renderApp('/demands/new');
    await screen.findByRole('heading', { name: 'New demand' });
    expect(screen.getByRole('button', { name: 'Remove line 1' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(screen.getAllByRole('listitem', { name: /Item line/ })).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(screen.getAllByRole('listitem', { name: /Item line/ })).toHaveLength(1);
  });
});

describe('Demand form — edit', () => {
  const editPath = `/demands/${DEMAND_ID}/edit`;

  it(
    'keeps a deactivated item selectable and sends the rev and line ids',
    async () => {
      const user = userEvent.setup();
      const existing = demandDetail({ rev: 3 });
      const { calls } = mockApi({
        ...session(),
        ...masterRoutes(),
        // The item on the existing line has since been deactivated.
        'GET /api/master/items': masterPage([syntheticItemTwo]),
        [`GET /api/demands/${DEMAND_ID}`]: json(200, {
          ...existing,
          lines: existing.lines.map((l) => ({
            ...l,
            item: { ...ref(syntheticItem), active: false },
          })),
        }),
        [`PATCH /api/demands/${DEMAND_ID}`]: json(200, demandDetail({ rev: 4 })),
      });
      renderApp(editPath);
      expect(await screen.findByRole('heading', { name: 'Edit DMD-000001' })).toBeInTheDocument();
      const item = within(line(1)).getByLabelText('Item');
      expect(item).toHaveValue(syntheticItem.id);
      expect(
        within(item).getByRole('option', { name: `${syntheticItem.name} (inactive)` }),
      ).toBeInTheDocument();
      expect(within(line(1)).getByLabelText('Receiver name (optional)')).toHaveValue(
        'Synthetic Receiver',
      );

      await user.clear(within(line(1)).getByLabelText('Quantity'));
      await user.type(within(line(1)).getByLabelText('Quantity'), '25');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Saved DMD-000001.')).toBeInTheDocument();
      const patch = calls.find((c) => c.method === 'PATCH');
      expect((patch?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
        operatorSession.csrfToken,
      );
      const body = JSON.parse(String(patch?.init?.body)) as Record<string, unknown>;
      expect(body.rev).toBe(3);
      expect(body.lines).toEqual([
        {
          id: existing.lines[0]?.id,
          itemId: syntheticItem.id,
          destinationDivisionId: syntheticDivisionB.id,
          quantity: 25,
          receiverName: 'Synthetic Receiver',
          receiverPhone: '0300 0000000',
        },
      ]);
    },
    LONG,
  );

  it('reports a version conflict and stays on the form', async () => {
    const user = userEvent.setup();
    mockApi({
      ...session(),
      ...masterRoutes(),
      [`GET /api/demands/${DEMAND_ID}`]: json(200, demandDetail()),
      [`PATCH /api/demands/${DEMAND_ID}`]: apiError(
        409,
        'CONFLICT',
        'This record was changed by someone else. Reload and try again.',
      ),
    });
    renderApp(editPath);
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('changed by someone else');
    expect(screen.getByRole('heading', { name: 'Edit DMD-000001' })).toBeInTheDocument();
  });

  it('refuses to edit a cancelled demand', async () => {
    mockApi({
      ...session(),
      ...masterRoutes(),
      [`GET /api/demands/${DEMAND_ID}`]: json(200, { ...demandDetail(), status: 'CANCELLED' }),
    });
    renderApp(editPath);
    expect(
      await screen.findByText('This demand is cancelled and cannot be changed.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
  });
});
