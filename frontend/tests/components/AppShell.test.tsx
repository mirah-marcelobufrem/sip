import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import AppShell from '../../src/components/layout/AppShell';

vi.mock('../../src/store/auth.store', () => ({
  useAuthStore: vi.fn((selector: (s: object) => unknown) =>
    selector({
      logout: vi.fn(),
      user: { email: 'test@example.com' },
      accessToken: 'token',
    }),
  ),
}));

function renderShell() {
  return render(
    <MemoryRouter>
      <AppShell />
    </MemoryRouter>,
  );
}

describe('AppShell hamburger menu', () => {
  it('renders the hamburger toggle button', () => {
    renderShell();
    expect(screen.getByRole('button', { name: /toggle navigation menu/i })).toBeTruthy();
  });

  it('sidebar is initially hidden (off-screen)', () => {
    renderShell();
    const sidebar = document.getElementById('app-sidebar');
    expect(sidebar?.className).toContain('-translate-x-full');
  });

  it('sidebar becomes visible when hamburger is clicked', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /toggle navigation menu/i }));
    const sidebar = document.getElementById('app-sidebar');
    expect(sidebar?.className).not.toContain('-translate-x-full');
  });

  it('backdrop is absent when menu is closed', () => {
    renderShell();
    expect(screen.queryByTestId('nav-backdrop')).toBeNull();
  });

  it('backdrop appears when menu is open', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /toggle navigation menu/i }));
    expect(screen.getByTestId('nav-backdrop')).toBeTruthy();
  });

  it('sidebar closes when backdrop is clicked', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /toggle navigation menu/i }));
    fireEvent.click(screen.getByTestId('nav-backdrop'));
    const sidebar = document.getElementById('app-sidebar');
    expect(sidebar?.className).toContain('-translate-x-full');
  });

  it('nav items are present in the sidebar', () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /toggle navigation menu/i }));
    expect(screen.getByText('Teams')).toBeTruthy();
    expect(screen.getByText('Scouting')).toBeTruthy();
    expect(screen.getByText('Tournaments')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('shows SIP Scout wordmark in the header', () => {
    renderShell();
    expect(screen.getByText('SIP Scout')).toBeTruthy();
  });

  it('shows user email in the sidebar footer', () => {
    renderShell();
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });
});
