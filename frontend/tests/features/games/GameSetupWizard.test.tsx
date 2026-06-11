import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GameSetupWizard from '../../../src/features/games/GameSetupWizard';
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

function mockApiGet() {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === `/teams/${TEAM_ID}/tournaments`) return Promise.resolve(TOURNAMENTS);
    if (path === `/teams/${TEAM_ID}/players`) return Promise.resolve([]);
    if (path === '/game-templates') return Promise.resolve([]);
    return Promise.reject(new Error(`Unexpected GET ${path}`));
  });
}

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GameSetupWizard teamId={TEAM_ID} teamName="My Team" onClose={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet();
  vi.mocked(api.post).mockResolvedValue({ id: '00000000-0000-0000-0000-000000000099' });
});

describe('GameSetupWizard — tournament selector', () => {
  it('renders the tournament select with options from the fetched list', async () => {
    renderWizard();

    const select = await screen.findByLabelText('Tournament') as HTMLSelectElement;
    expect(select).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Friendly' })).toBeTruthy();
      expect(screen.getByRole('option', { name: 'Spring Cup' })).toBeTruthy();
    });
  });

  it('defaults the selection to the "Friendly" tournament', async () => {
    renderWizard();

    const select = await screen.findByLabelText('Tournament') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.value).toBe(FRIENDLY_ID);
    });
  });

  it('includes the selected tournamentId in the POST body when creating the game', async () => {
    renderWizard();

    const select = await screen.findByLabelText('Tournament') as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(FRIENDLY_ID));

    fireEvent.change(select, { target: { value: CUP_ID } });
    expect(select.value).toBe(CUP_ID);

    // Step 1 -> 2 -> 3 -> 4
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /create game/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        `/teams/${TEAM_ID}/games`,
        expect.objectContaining({ tournamentId: CUP_ID }),
      );
    });
  });
});
