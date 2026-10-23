import { screen, waitFor, within } from '@testing-library/react';
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
} from './test/mockApi';

afterEach(() => vi.unstubAllGlobals());

const unauthenticated = () => apiError(401, 'UNAUTHENTICATED', 'Sign in required');

describe('routing and route protection', () => {
  it('sends signed-out users to the sign-in page', async () => {
    mockApi({ 'GET /api/auth/session': unauthenticated(), 'GET /api/health': healthOk });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: /Sign in/ })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'MAB Production Management System' }),
    ).toBeInTheDocument();
  });

  it('shows a loading state while the session is checked', async () => {
    const session = deferred();
    mockApi({
      'GET /api/auth/session': () => session.promise,
      'GET /api/health': healthOk,
    });
    renderApp('/');
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session');
    session.resolve(unauthenticated());
    expect(await screen.findByRole('heading', { name: /Sign in/ })).toBeInTheDocument();
  });

  it('explains an expired session on the sign-in page', async () => {
    mockApi({
      'GET /api/auth/session': apiError(401, 'SESSION_EXPIRED', 'Your session has expired.'),
      'GET /api/health': healthOk,
    });
    renderApp('/');
    expect(await screen.findByText(/Your session has expired/)).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes inside the app', async () => {
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': json(200, summaryFor(operatorSession)),
    });
    renderApp('/no-such-page');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('layout and navigation', () => {
  function signedIn(path = '/') {
    const api = mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': json(200, summaryFor(operatorSession)),
      'POST /api/auth/logout': new Response(null, { status: 204 }),
      'GET /api/health': healthOk,
    });
    renderApp(path);
    return api;
  }

  it('opens and closes the mobile menu with the button, Escape and the overlay', async () => {
    const user = userEvent.setup();
    signedIn();
    const open = await screen.findByRole('button', { name: 'Open menu' });
    expect(open).toHaveAttribute('aria-expanded', 'false');

    await user.click(open);
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();
    expect(open).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(open).toHaveFocus();

    await user.click(open);
    await user.click(screen.getByTestId('menu-overlay'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(open);
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the mobile menu after navigating and opens an honest placeholder for planned modules', async () => {
    const user = userEvent.setup();
    signedIn();
    await user.click(await screen.findByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    await user.click(within(drawer).getByRole('link', { name: /Receiving & stock/ }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Receiving & stock' })).toBeInTheDocument();
    expect(screen.getByText('Not available yet')).toBeInTheDocument();
    expect(screen.getByText(/planned for milestone/)).toHaveTextContent('M7');
    // A placeholder offers no form or action buttons that pretend to work.
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('marks the active page in the sidebar', async () => {
    signedIn('/modules/stock');
    const nav = (await screen.findAllByRole('navigation', { name: 'Main navigation' }))[0];
    if (!nav) throw new Error('navigation missing');
    expect(within(nav).getByRole('link', { name: /Receiving & stock/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: /Dashboard/ })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('signs out with the CSRF token and returns to the sign-in page', async () => {
    const user = userEvent.setup();
    const { calls } = signedIn();
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: /Sign in/ })).toBeInTheDocument();
    expect(screen.getByText('You have signed out.')).toBeInTheDocument();
    const logoutCall = calls.find((c) => c.method === 'POST' && c.path === '/api/auth/logout');
    expect(logoutCall).toBeDefined();
    const headers = logoutCall?.init?.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe(operatorSession.csrfToken);
    expect(logoutCall?.init?.credentials).toBe('include');
  });

  it('still signs out locally if the server cannot be reached', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': json(200, summaryFor(operatorSession)),
      'POST /api/auth/logout': () => Promise.reject(new TypeError('network down')),
      'GET /api/health': healthOk,
    });
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Sign in/ })).toBeInTheDocument(),
    );
  });
});
