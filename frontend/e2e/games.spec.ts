import { test, expect } from '@playwright/test';
import { createAndLogin, setupTeam } from './helpers';

test.describe('Games', () => {
  test('games page loads and shows + New Game button', async ({ page }) => {
    await createAndLogin(page, `games-load-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    const teamId = await setupTeam(page, 'Games Load Team');

    await page.goto(`/teams/${teamId}/games`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: '+ New Game' })).toBeVisible();
  });

  test('game wizard steps through to creation', async ({ page }) => {
    await createAndLogin(page, `games-wizard-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    const teamId = await setupTeam(page, 'Wizard Team');

    await page.goto(`/teams/${teamId}/games`);
    await page.waitForLoadState('networkidle');

    // Open the game setup wizard
    await page.getByRole('button', { name: '+ New Game' }).click();

    // Step 1 — Teams: fill in opponent name
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await page.getByLabel('Opponent / Away Team').fill('Rival Squad');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2 — Format
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3 — Starting Lineup
    await expect(page.getByText('Step 3 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4 — Confirm & Create
    await expect(page.getByText('Step 4 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Create Game' }).click();

    // After creation, navigate to the live recording page
    await page.waitForURL(/\/games\/[^/]+\/live/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/games\/[^/]+\/live/);
  });

  test('game wizard tournament selector defaults to Friendly and badge appears on Games page', async ({ page }) => {
    await createAndLogin(page, `games-tournament-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    const teamId = await setupTeam(page, 'Tournament Badge Team');

    await page.goto(`/teams/${teamId}/games`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '+ New Game' }).click();

    // Step 1 — Teams: tournament selector defaults to "Friendly"
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await page.getByLabel('Opponent / Away Team').fill('Tournament Rivals');

    const tournamentSelect = page.getByLabel('Tournament', { exact: true });
    await expect(tournamentSelect).toBeVisible();
    await expect(tournamentSelect.locator('option:checked')).toHaveText('Friendly');

    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2 — Format
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3 — Starting Lineup
    await expect(page.getByText('Step 3 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4 — Confirm & Create
    await expect(page.getByText('Step 4 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Create Game' }).click();

    await page.waitForURL(/\/games\/[^/]+\/live/, { timeout: 15_000 });

    // Back on the Games page, the new game shows a "Friendly" tournament badge
    await page.goto(`/teams/${teamId}/games`);
    await page.waitForLoadState('networkidle');

    const gamesList = page.locator('.space-y-3');
    await expect(gamesList.locator('span.rounded-full', { hasText: 'Friendly' })).toBeVisible();
  });

  test('tournament filter dropdown shows Friendly and filters the games list', async ({ page }) => {
    await createAndLogin(page, `games-filter-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    const teamId = await setupTeam(page, 'Tournament Filter Team');

    await page.goto(`/teams/${teamId}/games`);
    await page.waitForLoadState('networkidle');

    // Create a game (defaults to the auto-created "Friendly" tournament)
    await page.getByRole('button', { name: '+ New Game' }).click();
    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await page.getByLabel('Opponent / Away Team').fill('Filter Rivals');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 3 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 4 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Create Game' }).click();
    await page.waitForURL(/\/games\/[^/]+\/live/, { timeout: 15_000 });

    await page.goto(`/teams/${teamId}/games`);
    await page.waitForLoadState('networkidle');

    const filter = page.getByLabel('Filter by tournament');
    await expect(filter).toBeVisible();
    await expect(filter.locator('option', { hasText: 'Friendly' })).toHaveCount(1);

    // Selecting "Friendly" keeps the game visible — it's the only (auto-assigned) tournament
    await filter.selectOption({ label: 'Friendly' });
    await page.waitForLoadState('networkidle');
    const gamesList = page.locator('.space-y-3');
    await expect(gamesList.locator('span.rounded-full', { hasText: 'Friendly' })).toBeVisible();
  });
});
