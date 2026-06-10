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
});
