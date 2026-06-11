import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LiveRecordingPage from '../../../src/features/live/LiveRecordingPage';
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

const GAME_ID = '00000000-0000-0000-0000-000000000010';
const HOME_TEAM_ID = '00000000-0000-0000-0000-000000000001';
const AWAY_TEAM_ID = '00000000-0000-0000-0000-000000000002';

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: GAME_ID,
    homeTeamId: HOME_TEAM_ID,
    awayTeamId: AWAY_TEAM_ID,
    status: 'in_progress',
    currentPeriod: 1,
    numPeriods: 4,
    format: 'quarters',
    finalScoreHome: null,
    finalScoreAway: null,
    ...overrides,
  };
}

function mockApiGet(game: Record<string, unknown>) {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === `/games/${GAME_ID}`) return Promise.resolve(game);
    if (path === `/games/${GAME_ID}/log`) return Promise.resolve([]);
    if (path.endsWith('/players')) return Promise.resolve([]);
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/games/${GAME_ID}/live`]}>
        <Routes>
          <Route path="/games/:gameId/live" element={<LiveRecordingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.post).mockResolvedValue({
    id: '00000000-0000-0000-0000-000000000099',
    period: 1,
    clockTimeSeconds: null,
    playerId: null,
    teamId: HOME_TEAM_ID,
    statType: 'OREB',
  });
});

describe('LiveRecordingPage — foul bonus indicator (API-driven)', () => {
  it('shows BONUS for home when homeInBonus is true', async () => {
    mockApiGet(
      makeGame({
        homeTeamFoulsThisPeriod: 5,
        awayTeamFoulsThisPeriod: 2,
        homeInBonus: true,
        awayInBonus: false,
      }),
    );
    renderPage();

    expect(await screen.findByTestId('home-bonus')).toHaveTextContent('BONUS');
    expect(screen.queryByTestId('away-bonus')).toBeNull();
    expect(screen.getByTestId('away-team-fouls')).toHaveTextContent('2 fouls');
  });

  it('shows BONUS for away when awayInBonus is true', async () => {
    mockApiGet(
      makeGame({
        homeTeamFoulsThisPeriod: 1,
        awayTeamFoulsThisPeriod: 6,
        homeInBonus: false,
        awayInBonus: true,
      }),
    );
    renderPage();

    expect(await screen.findByTestId('away-bonus')).toHaveTextContent('BONUS');
    expect(screen.queryByTestId('home-bonus')).toBeNull();
    expect(screen.getByTestId('home-team-fouls')).toHaveTextContent('1 fouls');
  });

  it('hides BONUS and shows the foul count when inBonus is false', async () => {
    mockApiGet(
      makeGame({
        homeTeamFoulsThisPeriod: 4,
        awayTeamFoulsThisPeriod: 3,
        homeInBonus: false,
        awayInBonus: false,
      }),
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('home-team-fouls')).toHaveTextContent('4 fouls');
    });
    expect(screen.getByTestId('away-team-fouls')).toHaveTextContent('3 fouls');
    expect(screen.queryByTestId('home-bonus')).toBeNull();
    expect(screen.queryByTestId('away-bonus')).toBeNull();
  });

  it('renders safely with 0 fouls and no BONUS when the API fields are undefined (backend not yet deployed)', async () => {
    mockApiGet(makeGame());
    renderPage();

    expect(await screen.findByTestId('home-team-fouls')).toHaveTextContent('0 fouls');
    expect(screen.getByTestId('away-team-fouls')).toHaveTextContent('0 fouls');
    expect(screen.queryByTestId('home-bonus')).toBeNull();
    expect(screen.queryByTestId('away-bonus')).toBeNull();
  });
});

describe('LiveRecordingPage — team rebound', () => {
  it('records an OREB with isTeamRebound: true and no playerId, without selecting a player first', async () => {
    mockApiGet(makeGame());
    renderPage();

    fireEvent.click(await screen.findByTestId('team-rebound-btn'));
    fireEvent.click(screen.getByTestId('team-rebound-oreb'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/games/${GAME_ID}/events`,
        expect.objectContaining({
          statType: 'OREB',
          playerId: null,
          teamId: HOME_TEAM_ID,
          isTeamRebound: true,
          period: 1,
        }),
      );
    });
  });

  it('records a DREB for the away team when Away is toggled', async () => {
    mockApiGet(makeGame());
    renderPage();

    fireEvent.click(await screen.findByTestId('team-rebound-btn'));
    fireEvent.click(screen.getByRole('button', { name: 'Away' }));
    fireEvent.click(screen.getByTestId('team-rebound-dreb'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/games/${GAME_ID}/events`,
        expect.objectContaining({
          statType: 'DREB',
          playerId: null,
          teamId: AWAY_TEAM_ID,
          isTeamRebound: true,
        }),
      );
    });
  });

  it('closes the team rebound panel after a successful record', async () => {
    mockApiGet(makeGame());
    renderPage();

    fireEvent.click(await screen.findByTestId('team-rebound-btn'));
    fireEvent.click(screen.getByTestId('team-rebound-oreb'));

    await waitFor(() => {
      expect(screen.queryByTestId('team-rebound-oreb')).toBeNull();
    });
  });

  it('per-player events do not carry the isTeamRebound flag', async () => {
    mockApiGet(makeGame());
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === `/games/${GAME_ID}`) return Promise.resolve(makeGame());
      if (path === `/games/${GAME_ID}/log`) return Promise.resolve([]);
      if (path === `/teams/${HOME_TEAM_ID}/players`) {
        return Promise.resolve([
          {
            id: '00000000-0000-0000-0000-000000000021',
            firstName: 'Ana',
            lastName: 'Silva',
            jerseyNumber: 7,
            teamId: HOME_TEAM_ID,
            status: 'active',
          },
        ]);
      }
      if (path.endsWith('/players')) return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Assist' }));
    fireEvent.click(await screen.findByRole('button', { name: /#7/ }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/games/${GAME_ID}/events`,
        expect.not.objectContaining({ isTeamRebound: true }),
      );
    });
  });
});
