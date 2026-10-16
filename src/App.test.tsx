import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

afterEach(() => vi.unstubAllGlobals());

describe('App shell', () => {
  it('shows the API as online when the health check succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: 'ok', service: 'mab-pms-api', time: new Date().toISOString() }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /MAB Production Management System/ }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('api-status')).toHaveTextContent('Online'));
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:4000/api/health', expect.any(Object));
  });

  it('shows the API as unavailable when the health check fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('api-status')).toHaveTextContent('Unavailable'));
  });

  it('treats a malformed health response as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ hello: 'world' }), { status: 200 })),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('api-status')).toHaveTextContent('Unavailable'));
  });
});
