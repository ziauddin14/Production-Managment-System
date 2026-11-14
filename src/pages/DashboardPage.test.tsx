import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiError,
  deferred,
  healthOk,
  json,
  mockApi,
  operatorSession,
  renderApp,
  summaryFor,
  viewerSession,
} from '../test/mockApi';

afterEach(() => vi.unstubAllGlobals());

describe('DashboardPage', () => {
  it('shows a loading state, then indicators that are clearly not available yet', async () => {
    const summary = deferred();
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': () => summary.promise,
    });
    renderApp('/');
    expect(await screen.findByLabelText('Loading indicators')).toHaveAttribute('aria-busy', 'true');

    summary.resolve(json(200, summaryFor(operatorSession)));
    const card = await screen.findByRole('article', { name: 'Open demands' });
    expect(within(card).getByText('Not available yet')).toBeInTheDocument();
    expect(within(card).getByText('M5 Demand Management')).toBeInTheDocument();
    // No invented figures anywhere in the indicator cards.
    for (const article of screen.getAllByRole('article')) {
      expect(article.textContent).not.toMatch(/\d{2,}/);
    }
    expect(
      screen.getByText('Welcome, Synthetic Operator · Production Operator'),
    ).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.queryByText(/read-only access/)).not.toBeInTheDocument();
  });

  it('tells read-only users that they cannot change data', async () => {
    mockApi({
      'GET /api/auth/session': json(200, viewerSession),
      'GET /api/dashboard/summary': json(200, summaryFor(viewerSession)),
    });
    renderApp('/');
    expect(await screen.findByRole('note')).toHaveTextContent('You have read-only access');
  });

  it('shows an error with a working retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': () => {
        attempts += 1;
        return attempts === 1
          ? apiError(503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable')
          : json(200, summaryFor(operatorSession));
      },
    });
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Service temporarily unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('article', { name: 'Open demands' })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('shows an empty state when no indicators are configured', async () => {
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': json(200, summaryFor(operatorSession, { indicators: [] })),
    });
    renderApp('/');
    expect(await screen.findByText('No indicators are configured yet.')).toBeInTheDocument();
  });

  it('reports an unavailable database', async () => {
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': json(
        200,
        summaryFor(operatorSession, { system: { database: 'down' } }),
      ),
    });
    renderApp('/');
    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
  });

  it('returns to sign-in when the session expires while loading', async () => {
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': apiError(401, 'SESSION_EXPIRED', 'Your session has expired.'),
      'GET /api/health': healthOk,
    });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /Sign in/ })).toBeInTheDocument();
    expect(screen.getByText(/Your session has expired/)).toBeInTheDocument();
  });

  it('treats a malformed dashboard response as an error, not as data', async () => {
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': json(200, { indicators: 'nope' }),
    });
    renderApp('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected response');
  });

  it('shows stock, dispatch and outstanding-payment indicators, with money as PKR', async () => {
    const base = summaryFor(operatorSession);
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': json(200, {
        ...base,
        indicators: [
          ...base.indicators,
          {
            key: 'stockLots',
            label: 'Stock on hand',
            description: 'Units held in warehouses, by PO/item lot',
            status: 'available',
            value: 1200,
            plannedMilestone: null,
          },
          {
            key: 'dispatchesThisMonth',
            label: 'Dispatches this month',
            description: 'Bilty dispatches recorded this calendar month',
            status: 'available',
            value: 7,
            plannedMilestone: null,
          },
          {
            key: 'outstandingVendorPayments',
            label: 'Outstanding vendor payments',
            description: 'Approved PO amounts not yet paid',
            status: 'available',
            value: 125000.5,
            plannedMilestone: null,
          },
        ],
      }),
    });
    renderApp('/');
    expect(
      within(await screen.findByRole('article', { name: 'Stock on hand' })).getByText('1,200'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Dispatches this month' })).getByText('7'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Outstanding vendor payments' })).getByText(
        'PKR 125,000.50',
      ),
    ).toBeInTheDocument();
  });
});
