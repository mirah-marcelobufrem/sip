import { test, expect, type Page } from '@playwright/test';
import { createAndLogin, setupTeam } from './helpers';

/**
 * S08 v5 — One Team Universe: a game against a typed opponent creates a
 * scouted team, both sides are recordable (incl. mid-game jersey quick-add for
 * the away roster), and the box score resolves both teams' names.
 */

async function setupHomeTeam(page: Page, suffix: string): Promise<string> {
  await createAndLogin(page, suffix);
  await page.waitForURL(/\/teams/);
  const teamId = await setupTeam(page, `OTU Home ${suffix}`);

  await page.getByRole('button', { name: '+ Add Player' }).click();
  await expect(page.getByRole('heading', { name: 'Add Player' })).toBeVisible();
  await page.getByLabel('First name').fill('Homer');
  await page.getByLabel('Last name').fill('Starter');
  await page.getByRole('button', { name: 'Add Player' }).last().click();
  await expect(page.getByText('Homer Starter')).toBeVisible({ timeout: 10_000 });
  return teamId;
}

test.describe('One Team Universe — both-sides capture', () => {
  test('typed opponent becomes a scouted team; away jersey quick-add + box score', async ({ page }) => {
    const suffix = `otu-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const teamId = await setupHomeTeam(page, suffix);

    // Create a game against a free-typed opponent (no pre-existing team)
    await page.goto(`/teams/${teamId}/games`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '+ New Game' }).click();

    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await page.getByLabel('Opponent / Away Team').fill('Wildcats FC');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 3 of 4')).toBeVisible();
    await page.getByTestId('starter-toggle').first().click(); // mark Homer a starter (S09 flow)
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 4 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Create Game' }).click();

    await page.waitForURL(/\/games\/[^/]+\/live/, { timeout: 15_000 });
    const gameId = page.url().match(/\/games\/([^/]+)\/live/)![1];
    await page.getByRole('button', { name: 'Start Game' }).click();
    await expect(page.getByRole('button', { name: 'Shot' })).toBeVisible({ timeout: 10_000 });

    // Away roster is empty for a brand-new scouted team — discover #77 mid-game
    await page.getByLabel('Away jersey number').fill('77');
    await page.getByTestId('add-away-player').click();
    await expect(page.locator('button', { hasText: '#77' })).toBeVisible({ timeout: 10_000 });

    // Away scores a free throw (single-tap stat — no court picker)
    await page.getByRole('button', { name: 'FT Made' }).click();
    await page.locator('button', { hasText: '#77' }).click();
    await expect(page.getByRole('button', { name: 'Log (1)' })).toBeVisible({ timeout: 10_000 });

    // Home scores a free throw
    await page.getByRole('button', { name: 'FT Made' }).click();
    await page.locator('button', { hasText: 'Starter' }).first().click();
    await expect(page.getByRole('button', { name: 'Log (2)' })).toBeVisible({ timeout: 10_000 });

    // Box score resolves BOTH teams' names from the unified players table
    await page.goto(`/games/${gameId}/box-score`);
    await expect(page.getByText('Homer Starter')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Player #77')).toBeVisible();

    // The away side actually scored (away can finally be tracked)
    const awayRow = page.getByRole('row').filter({ hasText: 'Player #77' });
    await expect(awayRow.getByRole('cell').nth(2)).toHaveText('1'); // PTS column
  });
});
