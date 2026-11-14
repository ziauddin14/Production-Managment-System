import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, operatorSession, renderApp, viewerSession } from '../../test/mockApi';
import { page, syncJob, syncSummary } from '../../test/operationsFixtures';

afterEach(() => vi.unstubAllGlobals());

const failed = syncJob(1, { status: 'FAILED', attempts: 3, lastError: 'Synthetic lock error' });
const conflict = syncJob(2, { status: 'CONFLICT', attempts: 1 });
const done = syncJob(3, { status: 'DONE', attempts: 1 });

function routes(session = operatorSession) {
  return {
    'GET /api/auth/session': json(200, session),
    'GET /api/sync/summary': json(200, syncSummary()),
    'GET /api/sync/jobs': page([failed, conflict, done]),
    [`POST /api/sync/jobs/${failed.id}/retry`]: json(200, { ...failed, status: 'PENDING' }),
  };
}

describe('Excel sync status', () => {
  it('shows the processor note prominently and counts by status', async () => {
    mockApi(routes());
    renderApp('/sync');
    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent('Workbook processor is not enabled');
    expect(note).toHaveTextContent('Jobs are queued safely');
    const byStatus = screen.getByRole('region', { name: 'Jobs by status' });
    expect(within(byStatus).getByText('Pending').nextSibling).toHaveTextContent('4');
    expect(within(byStatus).getByText('Failed').nextSibling).toHaveTextContent('1');
    expect(within(byStatus).getByText('Done').nextSibling).toHaveTextContent('0');
  });

  it('offers retry only for failed and conflicting jobs and re-queues with the CSRF token', async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(routes());
    renderApp('/sync');
    const table = await screen.findByRole('table', { name: 'Sync jobs' });
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]!).getByRole('button', { name: 'Retry PO-000001' })).toBeInTheDocument();
    expect(within(rows[2]!).getByRole('button', { name: 'Retry PO-000002' })).toBeInTheDocument();
    expect(within(rows[3]!).queryByRole('button')).not.toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('Synthetic lock error');

    await user.click(within(rows[1]!).getByRole('button', { name: 'Retry PO-000001' }));
    expect(await screen.findByText('Job for PO-000001 was queued again.')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.path).toBe(`/api/sync/jobs/${failed.id}/retry`);
    expect((post?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      operatorSession.csrfToken,
    );
    await waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: 'Sync jobs' })).queryByRole('button', {
          name: 'Retry PO-000001',
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it('never shows retry to viewers', async () => {
    mockApi(routes(viewerSession));
    renderApp('/sync');
    const table = await screen.findByRole('table', { name: 'Sync jobs' });
    expect(within(table).queryAllByRole('button')).toHaveLength(0);
  });
});
