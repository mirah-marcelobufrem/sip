import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TournamentsPage from '../../../src/features/tournaments/TournamentsPage';
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
const OPPONENT_ID = '00000000-0000-0000-0000-000000000002';
const TOURNAMENT_ID = '00000000-0000-0000-0000-000000000099';

const TOURNAMENTS = [
  {
    id: TOURNAMENT_ID,
    name: 'ESTADUAL RS S14 2026',
    format: 'mixed',
    numTeams: 8,
    status: 'upcoming',
    startDate: null,
    endDate: null,
    shareToken: null,
  },
];

const MY_TEAMS = [{ id: TEAM_ID, name: 'Eagles' }];
const OPPONENT_TEAMS = [{ id: OPPONENT_ID, name: 'Rival Hawks' }];

function mockApiGet() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/tournaments') return Promise.resolve(TOURNAMENTS);
    if (path === '/teams') return Promise.resolve(MY_TEAMS);
    if (path === '/opponent-teams') return Promise.resolve(OPPONENT_TEAMS);
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TournamentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet();
  vi.mocked(api.post).mockResolvedValue({ id: 'new-tournament-id' });
});

describe('TournamentsPage', () => {
  it('renders existing tournaments', async () => {
    renderPage();
    expect(await screen.findByText('ESTADUAL RS S14 2026')).toBeTruthy();
  });

  it('shows a multi-select with own teams and opponent teams in the New Tournament modal', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '+ New Tournament' }));

    expect(await screen.findByRole('button', { name: 'Eagles' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Rival Hawks' })).toBeTruthy();
  });

  it('disables Create Tournament until at least 2 teams are selected', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '+ New Tournament' }));

    const eagles = await screen.findByRole('button', { name: 'Eagles' });
    const rivals = await screen.findByRole('button', { name: 'Rival Hawks' });
    const createBtn = screen.getByRole('button', { name: 'Create Tournament' });

    expect(createBtn).toBeDisabled();

    fireEvent.click(eagles);
    expect(createBtn).toBeDisabled();
    expect(screen.getByText('1 team selected')).toBeTruthy();

    fireEvent.click(rivals);
    expect(createBtn).not.toBeDisabled();
    expect(screen.getByText('2 teams selected')).toBeTruthy();
  });

  it('submits selected teams with seed order and teamId', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '+ New Tournament' }));

    fireEvent.change(screen.getByPlaceholderText(/city championship/i), {
      target: { value: 'Spring Cup' },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Eagles' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rival Hawks' }));

    fireEvent.click(screen.getByRole('button', { name: 'Create Tournament' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/tournaments', expect.objectContaining({
        name: 'Spring Cup',
        numTeams: 2,
        teams: [
          { seed: 1, teamId: TEAM_ID, teamName: 'Eagles' },
          { seed: 2, teamId: OPPONENT_ID, teamName: 'Rival Hawks' },
        ],
      }));
    });
  });
});
