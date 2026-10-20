import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  apiError,
  deferred,
  json,
  mockApi,
  operatorSession,
  renderApp,
  summaryFor,
  viewerSession,
} from '../../test/mockApi';
import {
  demandSummary,
  listResponse,
  masterRoutes,
  syntheticDepartment,
  syntheticProvinceB,
} from '../../test/demandFixtures';

afterEach(() => vi.unstubAllGlobals());

const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });
const demandCalls = (calls: { method: string; path: string; search: URLSearchParams }[]) =>
  calls.filter((c) => c.method === 'GET' && c.path === '/api/demands');

describe('Demands list', () => {
  it('is an active module in the navigation, not a placeholder', async () => {
    const user = userEvent.setup();
    mockApi({
      ...session(),
      ...masterRoutes(),
      'GET /api/dashboard/summary': json(200, summaryFor(operatorSession)),
      'GET /api/demands': listResponse([demandSummary(1)]),
    });
    renderApp('/');
    const nav = (await screen.findAllByRole('navigation', { name: 'Main navigation' }))[0];
    if (!nav) throw new Error('navigation missing');
    const link = within(nav).getByRole('link', { name: 'Demands' });
    expect(link).not.toHaveTextContent('M5');
    await user.click(link);

    expect(await screen.findByRole('heading', { name: 'Demands' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'DMD-000001' })).toHaveAttribute(
      'href',
      `/demands/${demandSummary(1).id}`,
    );
    expect(screen.queryByText('Not available yet')).not.toBeInTheDocument();
  });

  it('shows loading, then rows with status, and a New demand action for the operator', async () => {
    const list = deferred();
    mockApi({ ...session(), ...masterRoutes(), 'GET /api/demands': () => list.promise });
    renderApp('/demands');
    expect(await screen.findByLabelText('Loading demands')).toHaveAttribute('aria-busy', 'true');

    list.resolve(
      listResponse([
        demandSummary(2, { totalQuantity: 1500, lineCount: 3 }),
        demandSummary(1, { status: 'CANCELLED' }),
      ]),
    );
    const table = await screen.findByRole('table', { name: 'Demands' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1] as HTMLElement).getByText('Pending')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText((1500).toLocaleString())).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New demand' })).toHaveAttribute(
      'href',
      '/demands/new',
    );
  });

  it('hides the New demand action from viewers', async () => {
    mockApi({
      ...session(viewerSession),
      ...masterRoutes(),
      'GET /api/demands': listResponse([demandSummary(1)]),
    });
    renderApp('/demands');
    expect(await screen.findByRole('link', { name: 'DMD-000001' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New demand' })).not.toBeInTheDocument();
  });

  it('distinguishes an empty register from an empty filter result', async () => {
    const user = userEvent.setup();
    mockApi({ ...session(), ...masterRoutes(), 'GET /api/demands': listResponse([]) });
    renderApp('/demands');
    expect(await screen.findByText(/No demands have been registered yet/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search demands'), 'nothing');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No demands match these filters.')).toBeInTheDocument();
  });

  it('shows an error with a retry that reloads the list', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockApi({
      ...session(),
      ...masterRoutes(),
      'GET /api/demands': () => {
        attempts += 1;
        return attempts === 1
          ? apiError(500, 'INTERNAL', 'Something went wrong on the server.')
          : listResponse([demandSummary(1)]);
      },
    });
    renderApp('/demands');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong on the server.',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'DMD-000001' })).toBeInTheDocument();
  });

  it('sends search, filters and sort to the API and resets to page 1', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      ...session(),
      ...masterRoutes(),
      'GET /api/demands': (_init, url) =>
        listResponse([demandSummary(1)], 60, Number(url.searchParams.get('page') ?? 1)),
    });
    renderApp('/demands');
    expect(await screen.findByRole('link', { name: 'DMD-000001' })).toBeInTheDocument();
    const first = demandCalls(calls)[0];
    expect(first?.search.get('status')).toBe('open');
    expect(first?.search.get('sort')).toBe('demandDate_desc');
    expect(first?.search.get('page')).toBe('1');
    expect(first?.search.get('pageSize')).toBe('25');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(demandCalls(calls).at(-1)?.search.get('page')).toBe('2');

    // Province options load from master data (including inactive records).
    await screen.findByRole('option', { name: syntheticProvinceB.name });
    await user.selectOptions(screen.getByLabelText('Province'), syntheticProvinceB.id);
    await user.selectOptions(screen.getByLabelText('Department'), syntheticDepartment.id);
    await user.selectOptions(screen.getByLabelText('Status'), 'all');
    await user.selectOptions(screen.getByLabelText('Sort'), 'code_asc');
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2030-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2030-01-31' } });
    await user.type(screen.getByLabelText('Search demands'), 'DMD-0000');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => expect(demandCalls(calls).at(-1)?.search.get('search')).toBe('DMD-0000'));
    const last = demandCalls(calls).at(-1);
    expect(last?.search.get('provinceId')).toBe(syntheticProvinceB.id);
    expect(last?.search.get('departmentId')).toBe(syntheticDepartment.id);
    expect(last?.search.get('status')).toBe('all');
    expect(last?.search.get('sort')).toBe('code_asc');
    expect(last?.search.get('from')).toBe('2030-01-01');
    expect(last?.search.get('to')).toBe('2030-01-31');
    expect(last?.search.get('page')).toBe('1');
  });

  it('rejects a date range where From is after To without calling the API', async () => {
    const { calls } = mockApi({
      ...session(),
      ...masterRoutes(),
      'GET /api/demands': listResponse([demandSummary(1)]),
    });
    renderApp('/demands');
    expect(await screen.findByRole('link', { name: 'DMD-000001' })).toBeInTheDocument();
    // A From date on its own is a valid filter and is sent.
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2030-02-01' } });
    await waitFor(() => expect(demandCalls(calls).at(-1)?.search.get('from')).toBe('2030-02-01'));
    expect(await screen.findByRole('link', { name: 'DMD-000001' })).toBeInTheDocument();
    const before = demandCalls(calls).length;

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2030-01-01' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('“From” must not be after “To”.');
    expect(screen.getByLabelText('From')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(demandCalls(calls)).toHaveLength(before);
  });
});
