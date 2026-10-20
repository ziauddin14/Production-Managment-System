import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiError,
  deferred,
  json,
  mockApi,
  operatorSession,
  renderApp,
  viewerSession,
} from '../../test/mockApi';
import { DEMAND_ID, demandDetail } from '../../test/demandFixtures';

afterEach(() => vi.unstubAllGlobals());

const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });
const path = `/demands/${DEMAND_ID}`;

describe('Demand detail', () => {
  it('shows loading, then header details, lines and receiver data for the operator', async () => {
    const detail = deferred();
    mockApi({ ...session(), [`GET /api${path}`]: () => detail.promise });
    renderApp(path);
    expect(await screen.findByLabelText('Loading demand')).toHaveAttribute('aria-busy', 'true');

    detail.resolve(json(200, demandDetail()));
    expect(await screen.findByRole('heading', { name: 'DMD-000001' })).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Department')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Division A1')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Demand items' });
    expect(within(table).getByRole('columnheader', { name: 'Receiver' })).toBeInTheDocument();
    expect(within(table).getByText('Synthetic Item One')).toBeInTheDocument();
    expect(within(table).getByText('Synthetic Province B')).toBeInTheDocument();
    expect(within(table).getByText('Synthetic Receiver')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `${path}/edit`);
    expect(screen.getByRole('button', { name: 'Cancel demand' })).toBeInTheDocument();
  });

  it('marks deactivated references as inactive', async () => {
    const base = demandDetail();
    mockApi({
      ...session(),
      [`GET /api${path}`]: json(200, {
        ...base,
        department: { ...base.department, active: false },
      }),
    });
    renderApp(path);
    const label = await screen.findByText('Synthetic Department');
    expect(label.parentElement).toHaveTextContent('Synthetic Department(inactive)');
  });

  it('gives viewers no receiver column and no write actions', async () => {
    const base = demandDetail();
    mockApi({
      ...session(viewerSession),
      [`GET /api${path}`]: json(200, {
        ...base,
        personalDataVisible: false,
        lines: base.lines.map(({ receiverName: _n, receiverPhone: _p, ...line }) => line),
      }),
    });
    renderApp(path);
    const table = await screen.findByRole('table', { name: 'Demand items' });
    expect(within(table).queryByRole('columnheader', { name: 'Receiver' })).not.toBeInTheDocument();
    expect(screen.queryByText('Synthetic Receiver')).not.toBeInTheDocument();
    expect(screen.getByText(/visible to the Production Operator only/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel demand' })).not.toBeInTheDocument();
  });

  it('shows a not-found error without a retry', async () => {
    mockApi({
      ...session(),
      [`GET /api${path}`]: apiError(404, 'NOT_FOUND', 'Demand not found.'),
    });
    renderApp(path);
    expect(await screen.findByRole('alert')).toHaveTextContent('Demand not found.');
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });

  it('shows a cancelled demand read-only with its reason', async () => {
    mockApi({
      ...session(),
      [`GET /api${path}`]: json(200, {
        ...demandDetail(),
        status: 'CANCELLED',
        cancellation: {
          at: '2030-01-06T05:00:00.000Z',
          reason: 'Synthetic duplicate request',
          by: 'synthetic.operator',
        },
      }),
    });
    renderApp(path);
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Reason: Synthetic duplicate request');
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel demand' })).not.toBeInTheDocument();
  });

  it('cancels with a required reason, the current rev and the CSRF token', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      ...session(),
      [`GET /api${path}`]: json(200, demandDetail({ rev: 4 })),
      [`POST /api${path}/cancel`]: json(200, {
        ...demandDetail({ rev: 5 }),
        status: 'CANCELLED',
        cancellation: {
          at: '2030-01-06T05:00:00.000Z',
          reason: 'Synthetic reason',
          by: 'synthetic.operator',
        },
      }),
    });
    renderApp(path);
    await user.click(await screen.findByRole('button', { name: 'Cancel demand' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel DMD-000001?' });

    await user.click(within(dialog).getByRole('button', { name: 'Cancel demand' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a reason for cancelling.');
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.type(within(dialog).getByLabelText('Reason'), '  Synthetic reason  ');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel demand' }));

    expect(await screen.findByText('Demand DMD-000001 was cancelled.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toEqual({ rev: 4, reason: 'Synthetic reason' });
    expect((post?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      operatorSession.csrfToken,
    );
    expect(screen.queryByRole('button', { name: 'Cancel demand' })).not.toBeInTheDocument();
  });

  it('keeps the dialog open and shows a version conflict from the server', async () => {
    const user = userEvent.setup();
    mockApi({
      ...session(),
      [`GET /api${path}`]: json(200, demandDetail()),
      [`POST /api${path}/cancel`]: apiError(
        409,
        'CONFLICT',
        'This record was changed by someone else. Reload and try again.',
      ),
    });
    renderApp(path);
    await user.click(await screen.findByRole('button', { name: 'Cancel demand' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Reason'), 'Synthetic reason');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel demand' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('changed by someone else');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
