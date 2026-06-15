import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RosterManager from '../../../src/features/players/RosterManager';
import { api } from '../../../src/lib/api';

vi.mock('../../../src/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const PLAYERS = [
  { id: 'p1', firstName: 'Ana', lastName: 'A', jerseyNumber: 4, position: 'PG', status: 'active' },
  { id: 'p2', firstName: 'Bia', lastName: 'B', jerseyNumber: 7, position: 'SG', status: 'active' },
];

const ROSTERS = [
  { id: 'r1', name: 'Full Squad', seasonLabel: null, isDefault: true, playerIds: ['p1'] },
];

function renderManager() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RosterManager teamId="t1" players={PLAYERS} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue(ROSTERS);
  vi.mocked(api.post).mockResolvedValue({ id: 'r2' });
  vi.mocked(api.put).mockResolvedValue({});
});

describe('RosterManager (U-04)', () => {
  it('lists rosters with the default badge and player count', async () => {
    renderManager();
    await waitFor(() => expect(screen.getByText('Full Squad')).toBeInTheDocument());
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(screen.getByText('1 players')).toBeInTheDocument();
  });

  it('opens the create-roster modal', async () => {
    renderManager();
    await waitFor(() => screen.getByText('Full Squad'));
    fireEvent.click(screen.getByText('+ New Roster'));
    expect(screen.getByText('New Roster')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('edits membership and saves the selected player ids', async () => {
    renderManager();
    await waitFor(() => screen.getByText('Full Squad'));
    // open the membership editor for the roster
    fireEvent.click(screen.getByTestId('roster-row'));
    await waitFor(() => expect(screen.getByText('Save Roster')).toBeInTheDocument());

    // p1 starts selected (1 player). Toggle p2 on → 2 selected.
    const toggles = screen.getAllByTestId('roster-player-toggle');
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[1]); // Bia
    fireEvent.click(screen.getByText('Save Roster'));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/teams/t1/rosters/r1/players', {
        playerIds: ['p1', 'p2'],
      }),
    );
  });
});
