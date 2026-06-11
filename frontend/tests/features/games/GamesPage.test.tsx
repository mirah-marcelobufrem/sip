import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GamesPage from '../../../src/features/games/GamesPage';
import { api } from '../../../src/lib/api';

vi.mock('../../../src/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const FRIENDLY_ID = '00000000-0000-0000-0000-000000000002';
const CUP_ID = '00000000-0000-0000-0000-000000000003';

const TOURNAMENTS = [
  { id: FRIENDLY_ID, name: 'Friendly' },
  { id: CUP_ID, name: 'Spring Cup' },
];

const GAMES = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    date: '2026-01-15T18:00:00.000Z',
    location: null,
    status: 'completed',
    finalScoreHome: 80,
    finalScoreAway: 70,
    numPeriods: 4,
    format: 'quarters',
    tournamentId: CUP_ID,
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    date: '2026-01-20T18:00:00.000Z',
    location: null,
    status: 'scheduled',
    finalScoreHome: null,
    finalScoreAway: null,
    numPeriods: 4,
    format: 'quarters',
    tournamentId: null,
  },
];

function mockApiGet() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === `/teams/${TEAM_ID}/tournaments`) return Promise.resolve(TOURNAMENTS);
    if (path === `/teams/${TEAM_ID}/games`) return Promise.resolve(GAMES);
    if (path === `/teams/${TEAM_ID}/games?tournamentId=${CUP_ID}`) {
      return Promise.resolve([GAMES[0]]);
    }
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/teams/${TEAM_ID}/games`]}>
        <Routes>
          <Route path="/teams/:teamId/games" element={<GamesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet();
});

describe('GamesPage — tournament filter and badges', () => {
  it('renders the tournament filter dropdown with fetched tournament names', async () => {
    renderPage();

    const select = await screen.findByLabelText(/filter by tournament/i) as HTMLSelectElement;
    expect(screen.getByRole('option', { name: 'All Tournaments' })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Friendly' })).toBeTruthy();
      expect(screen.getByRole('option', { name: 'Spring Cup' })).toBeTruthy();
    });
    expect(select.value).toBe('');
  });

  it('selecting a tournament refetches games with ?tournamentId= in the path', async () => {
    renderPage();

    const select = await screen.findByLabelText(/filter by tournament/i) as HTMLSelectElement;
    await waitFor(() => expect(screen.getByRole('option', { name: 'Spring Cup' })).toBeTruthy());

    fireEvent.change(select, { target: { value: CUP_ID } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(`/teams/${TEAM_ID}/games?tournamentId=${CUP_ID}`);
    });
  });

  it('shows a tournament name badge on a game card whose tournamentId matches a known tournament', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Spring Cup').length).toBeGreaterThan(0);
    });
    // The game with tournamentId: null should not render an "undefined" or empty badge
    expect(screen.queryByText('undefined')).toBeNull();
  });
});
