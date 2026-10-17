import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MasterRecord } from '../../contracts/masterData';
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

afterEach(() => vi.unstubAllGlobals());

// ---- Synthetic fixtures only: every name is prefixed "Synthetic". ----
let seq = 0;
function record(name: string, overrides: Partial<MasterRecord> = {}): MasterRecord {
  seq += 1;
  return {
    id: String(seq).padStart(24, '0'),
    code: `TST-${String(seq).padStart(6, '0')}`,
    name,
    active: true,
    rev: 1,
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function page(items: MasterRecord[], total = items.length, pageNo = 1, pageSize = 25) {
  return json(200, { items, page: pageNo, pageSize, total });
}

const session = (s = operatorSession) => ({ 'GET /api/auth/session': json(200, s) });

describe('Master data — navigation and lists', () => {
  it('opens from the sidebar and defaults to provinces', async () => {
    const user = userEvent.setup();
    mockApi({
      ...session(),
      'GET /api/dashboard/summary': json(200, summaryFor(operatorSession)),
      'GET /api/master/provinces': page([record('Synthetic Province')]),
    });
    renderApp('/');
    const nav = (await screen.findAllByRole('navigation', { name: 'Main navigation' }))[0];
    if (!nav) throw new Error('navigation missing');
    const link = within(nav).getByRole('link', { name: 'Master data' });
    expect(link).not.toHaveTextContent('M4'); // no longer a planned module
    await user.click(link);

    expect(await screen.findByRole('heading', { name: 'Provinces' })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Synthetic Province' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Master data' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('shows a loading state, then the records', async () => {
    const response = deferred();
    mockApi({ ...session(), 'GET /api/master/items': () => response.promise });
    renderApp('/master-data/items');
    expect(await screen.findByLabelText('Loading items')).toHaveAttribute('aria-busy', 'true');
    response.resolve(page([record('Synthetic Box'), record('Synthetic Book', { active: false })]));
    const table = await screen.findByRole('table', { name: 'Items' });
    expect(within(table).getByText('Synthetic Box')).toBeInTheDocument();
    expect(within(table).getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–2 of 2')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    mockApi({ ...session(), 'GET /api/master/vendors': page([]) });
    renderApp('/master-data/vendors');
    expect(await screen.findByText(/No vendors have been added yet/)).toBeInTheDocument();
  });

  it('shows an error state with a working retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    mockApi({
      ...session(),
      'GET /api/master/warehouses': () => {
        attempts += 1;
        return attempts === 1
          ? apiError(503, 'SERVICE_UNAVAILABLE', 'Service temporarily unavailable')
          : page([record('Synthetic Store')]);
      },
    });
    renderApp('/master-data/warehouses');
    expect(await screen.findByRole('alert')).toHaveTextContent('Service temporarily unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('cell', { name: 'Synthetic Store' })).toBeInTheDocument();
  });

  it('shows not-found for an unknown list', async () => {
    mockApi(session());
    renderApp('/master-data/bilties');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('switches lists with the tabs', async () => {
    const user = userEvent.setup();
    mockApi({
      ...session(),
      'GET /api/master/provinces': page([]),
      'GET /api/master/departments': page([record('Synthetic Department')]),
    });
    renderApp('/master-data/provinces');
    const tabs = await screen.findByRole('navigation', { name: 'Master data lists' });
    await user.click(within(tabs).getByRole('link', { name: 'Departments' }));
    expect(await screen.findByRole('cell', { name: 'Synthetic Department' })).toBeInTheDocument();
  });
});

describe('Master data — search, filters and pagination', () => {
  it('sends search, status and page parameters to the server', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({
      ...session(),
      'GET /api/master/items': (_init, url) => {
        const pageNo = Number(url.searchParams.get('page') ?? 1);
        return page([record(`Synthetic Item p${pageNo}`)], 30, pageNo, 25);
      },
    });
    renderApp('/master-data/items');
    await screen.findByText('Showing 1–25 of 30');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('Showing 26–30 of 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    await user.type(screen.getByLabelText('Search items'), '  synthetic box ');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.selectOptions(screen.getByLabelText('Status'), 'all');

    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/api/master/items').at(-1);
      expect(last?.search.get('search')).toBe('synthetic box');
      expect(last?.search.get('status')).toBe('all');
      expect(last?.search.get('page')).toBe('1'); // filters reset to page 1
    });
  });

  it('explains when filters match nothing', async () => {
    const user = userEvent.setup();
    mockApi({
      ...session(),
      'GET /api/master/vendors': (_init, url) =>
        url.searchParams.get('search') ? page([]) : page([record('Synthetic Vendor')]),
    });
    renderApp('/master-data/vendors');
    await screen.findByRole('cell', { name: 'Synthetic Vendor' });
    await user.type(screen.getByLabelText('Search vendors'), 'nothing');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('No vendors match these filters.')).toBeInTheDocument();
  });

  it('filters divisions by province', async () => {
    const user = userEvent.setup();
    const province = record('Synthetic Province');
    const { calls } = mockApi({
      ...session(),
      'GET /api/master/provinces': page([province]),
      'GET /api/master/divisions': page([
        record('Synthetic Division', { provinceId: province.id, provinceName: province.name }),
      ]),
    });
    renderApp('/master-data/divisions');
    expect(await screen.findByRole('cell', { name: 'Synthetic Province' })).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText('Province'), province.id);
    await waitFor(() =>
      expect(
        calls
          .filter((c) => c.path === '/api/master/divisions')
          .at(-1)
          ?.search.get('provinceId'),
      ).toBe(province.id),
    );
  });
});

describe('Master data — create, edit and deactivate', () => {
  it('validates the form before calling the server', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi({ ...session(), 'GET /api/master/items': page([]) });
    renderApp('/master-data/items');
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = screen.getByRole('dialog', { name: 'New item' });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Enter a name.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('creates a record with the CSRF token and shows success', async () => {
    const user = userEvent.setup();
    let created = false;
    const { calls } = mockApi({
      ...session(),
      'GET /api/master/items': () => page(created ? [record('Synthetic Box')] : []),
      'POST /api/master/items': () => {
        created = true;
        return json(201, record('Synthetic Box', { code: 'ITM-000001' }));
      },
    });
    renderApp('/master-data/items');
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    await user.type(screen.getByLabelText('Name'), '  Synthetic Box ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Created ITM-000001 “Synthetic Box”.',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Synthetic Box' })).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(JSON.parse(String(post?.init?.body))).toEqual({ name: 'Synthetic Box' });
    expect((post?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      operatorSession.csrfToken,
    );
  });

  it('shows a duplicate-name conflict from the server in the form', async () => {
    const user = userEvent.setup();
    mockApi({
      ...session(),
      'GET /api/master/vendors': page([]),
      'POST /api/master/vendors': apiError(
        409,
        'CONFLICT',
        'A vendor with this name already exists',
      ),
    });
    renderApp('/master-data/vendors');
    await user.click(await screen.findByRole('button', { name: 'New vendor' }));
    await user.type(screen.getByLabelText('Name'), 'Synthetic Vendor');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'A vendor with this name already exists',
    );
  });

  it('maps server field errors onto the form fields', async () => {
    const user = userEvent.setup();
    const province = record('Synthetic Province');
    mockApi({
      ...session(),
      'GET /api/master/divisions': page([]),
      'GET /api/master/provinces': page([province]),
      'POST /api/master/divisions': json(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Input validation failed',
          details: [{ path: 'provinceId', message: 'Province "Synthetic Province" is inactive' }],
        },
      }),
    });
    renderApp('/master-data/divisions');
    await user.click(await screen.findByRole('button', { name: 'New division' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Choose a province.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Name'), 'Synthetic Division');
    await user.selectOptions(await within(dialog).findByLabelText('Province'), province.id);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText(/is inactive/)).toBeInTheDocument();
  });

  it('edits a record, sending only changed fields with the revision', async () => {
    const user = userEvent.setup();
    const item = record('Synthetic Old', { rev: 3 });
    const { calls } = mockApi({
      ...session(),
      'GET /api/master/items': page([item]),
      [`PATCH /api/master/items/${item.id}`]: json(200, { ...item, name: 'Synthetic New', rev: 4 }),
    });
    renderApp('/master-data/items');
    await user.click(await screen.findByRole('button', { name: 'Edit Synthetic Old' }));
    const nameInput = screen.getByLabelText('Name');
    expect(nameInput).toHaveValue('Synthetic Old');
    await user.clear(nameInput);
    await user.type(nameInput, 'Synthetic New');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(JSON.parse(String(patch?.init?.body))).toEqual({ rev: 3, name: 'Synthetic New' });
  });

  it('deactivates a record and reports server conflicts', async () => {
    const user = userEvent.setup();
    const province = record('Synthetic Province', { rev: 2 });
    mockApi({
      ...session(),
      'GET /api/master/provinces': page([province]),
      [`PATCH /api/master/provinces/${province.id}`]: apiError(
        409,
        'CONFLICT',
        'This province has 1 active division. Deactivate them first.',
      ),
    });
    renderApp('/master-data/provinces');
    await user.click(await screen.findByRole('button', { name: 'Deactivate Synthetic Province' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('1 active division');
  });

  it('closes the form with Escape and Cancel', async () => {
    const user = userEvent.setup();
    mockApi({ ...session(), 'GET /api/master/items': page([]) });
    renderApp('/master-data/items');
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New item' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Master data — read-only users', () => {
  it('hides every write action from read-only users', async () => {
    const { calls } = mockApi({
      ...session(viewerSession),
      'GET /api/master/items': page([record('Synthetic Box')]),
    });
    renderApp('/master-data/items');
    expect(await screen.findByRole('cell', { name: 'Synthetic Box' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent('Read-only access');
    expect(screen.queryByRole('button', { name: /New item/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deactivate/ })).not.toBeInTheDocument();
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('returns to sign-in when the session expires', async () => {
    mockApi({
      ...session(),
      'GET /api/master/items': apiError(401, 'SESSION_EXPIRED', 'Your session has expired.'),
      'GET /api/health': json(200, { status: 'ok', service: 'mab-pms-api', time: 'x' }),
    });
    renderApp('/master-data/items');
    expect(await screen.findByRole('heading', { name: /Sign in/ })).toBeInTheDocument();
  });
});
