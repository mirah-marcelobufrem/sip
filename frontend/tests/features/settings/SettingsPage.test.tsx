import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from '../../../src/features/settings/SettingsPage';
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ preferences: { language: 'pt', units: 'metric' } });
});

describe('SettingsPage (N-12 settings honesty)', () => {
  it('no longer renders the language selector (hidden until i18n exists)', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Units')).toBeInTheDocument());
    expect(screen.queryByText('Language')).not.toBeInTheDocument();
  });

  it('still renders the units selector, which is now applied to displays', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Units')).toBeInTheDocument());
  });
});
