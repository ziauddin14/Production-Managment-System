import { screen } from '@testing-library/react';
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
} from '../test/mockApi';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

const SYNTHETIC_PASSWORD = 'synthetic operator pass 1';

function signedOutApi(loginResponse: Response | (() => Response)) {
  return mockApi({
    'GET /api/auth/session': apiError(401, 'UNAUTHENTICATED', 'Sign in required'),
    'GET /api/health': healthOk,
    'POST /api/auth/login': typeof loginResponse === 'function' ? loginResponse : loginResponse,
    'GET /api/dashboard/summary': json(200, summaryFor(operatorSession)),
  });
}

describe('LoginPage', () => {
  it('validates required fields before calling the server', async () => {
    const user = userEvent.setup();
    const { calls } = signedOutApi(json(200, operatorSession));
    renderApp('/login');
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    expect(calls.some((c) => c.path === '/api/auth/login')).toBe(false);
  });

  it('shows the server message for invalid credentials and clears the password', async () => {
    const user = userEvent.setup();
    signedOutApi(apiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password'));
    renderApp('/login');
    await user.type(await screen.findByLabelText('Username'), 'synthetic.operator');
    await user.type(screen.getByLabelText('Password'), 'synthetic wrong password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid username or password');
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(screen.getByLabelText('Username')).toHaveValue('synthetic.operator');
  });

  it('shows lockout and network errors', async () => {
    const user = userEvent.setup();
    signedOutApi(
      apiError(429, 'ACCOUNT_LOCKED', 'Too many failed sign-in attempts. Try again later.'),
    );
    renderApp('/login');
    await user.type(await screen.findByLabelText('Username'), 'synthetic.operator');
    await user.type(screen.getByLabelText('Password'), SYNTHETIC_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many failed sign-in attempts');
  });

  it('reports an unreachable server clearly', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /api/auth/session': apiError(401, 'UNAUTHENTICATED', 'Sign in required'),
      'GET /api/health': healthOk,
      'POST /api/auth/login': () => Promise.reject(new TypeError('Failed to fetch')),
    });
    renderApp('/login');
    await user.type(await screen.findByLabelText('Username'), 'synthetic.operator');
    await user.type(screen.getByLabelText('Password'), SYNTHETIC_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached');
  });

  it('disables the button while signing in, then opens the dashboard', async () => {
    const user = userEvent.setup();
    const loginResponse = deferred();
    const { calls } = signedOutApi((() => loginResponse.promise) as never);
    renderApp('/login');
    await user.type(await screen.findByLabelText('Username'), '  synthetic.operator ');
    await user.type(screen.getByLabelText('Password'), SYNTHETIC_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    loginResponse.resolve(json(200, operatorSession));
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    const loginCall = calls.find((c) => c.path === '/api/auth/login');
    expect(JSON.parse(String(loginCall?.init?.body))).toEqual({
      username: 'synthetic.operator',
      password: SYNTHETIC_PASSWORD,
    });
    expect(loginCall?.init?.credentials).toBe('include');
  });

  it('returns to the page the user originally requested', async () => {
    const user = userEvent.setup();
    signedOutApi(json(200, operatorSession));
    renderApp('/modules/finance');
    await user.type(await screen.findByLabelText('Username'), 'synthetic.operator');
    await user.type(screen.getByLabelText('Password'), SYNTHETIC_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Payments & finance' })).toBeInTheDocument();
  });

  it('can show and hide the password', async () => {
    const user = userEvent.setup();
    signedOutApi(json(200, operatorSession));
    renderApp('/login');
    const password = await screen.findByLabelText('Password');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('keeps no credentials or session token in browser storage', async () => {
    const user = userEvent.setup();
    signedOutApi(json(200, operatorSession));
    renderApp('/login');
    await user.type(await screen.findByLabelText('Username'), 'synthetic.operator');
    await user.type(screen.getByLabelText('Password'), SYNTHETIC_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Dashboard' });

    const stored =
      JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie;
    expect(stored).not.toContain(SYNTHETIC_PASSWORD);
    expect(stored).not.toContain(operatorSession.csrfToken);
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('redirects signed-in users away from the sign-in page', async () => {
    mockApi({
      'GET /api/auth/session': json(200, operatorSession),
      'GET /api/dashboard/summary': json(200, summaryFor(operatorSession)),
    });
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
