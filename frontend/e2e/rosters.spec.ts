import { test, expect } from '@playwright/test';
import { createAndLogin, setupTeam } from './helpers';

// S09 v5 — Rosters & Eligibility (U-04). The Roster page shows a roster manager;
// a default "Full Squad" roster is auto-created and tracks the player list.
test.describe('Rosters', () => {
  async function addPlayer(page: import('@playwright/test').Page, first: string, last: string) {
    await page.getByRole('button', { name: '+ Add Player' }).click();
    await page.getByLabel('First name').fill(first);
    await page.getByLabel('Last name').fill(last);
    await page.getByRole('button', { name: 'Add Player' }).last().click();
    await page.getByText(`${first} ${last}`).waitFor();
  }

  test('default roster is created and reflects the team players', async ({ page }) => {
    await createAndLogin(page, `s09def-${Date.now()}`);
    await setupTeam(page, 'Squad Default Team');

    await addPlayer(page, 'Ana', 'Alpha');
    await addPlayer(page, 'Bia', 'Bravo');

    const manager = page.getByTestId('roster-manager');
    await expect(manager.getByText('Rosters')).toBeVisible();
    // The default "Full Squad" roster tracks both players.
    const defaultRow = page.getByTestId('roster-row').filter({ hasText: 'Full Squad' });
    await expect(defaultRow).toBeVisible({ timeout: 8_000 });
    await expect(defaultRow).toContainText('Default');
    await expect(defaultRow).toContainText('2 players');
  });

  test('create a new roster and edit its membership', async ({ page }) => {
    await createAndLogin(page, `s09new-${Date.now()}`);
    await setupTeam(page, 'Squad Create Team');

    await addPlayer(page, 'Carl', 'Charlie');

    // Create a new roster
    await page.getByRole('button', { name: '+ New Roster' }).click();
    await expect(page.getByRole('heading', { name: 'New Roster' })).toBeVisible();
    await page.getByLabel('Name').fill('Travel Squad');
    await page.getByRole('button', { name: 'Create Roster' }).click();

    const newRow = page.getByTestId('roster-row').filter({ hasText: 'Travel Squad' });
    await expect(newRow).toBeVisible({ timeout: 8_000 });
    await expect(newRow).toContainText('0 players');

    // Edit membership — toggle the player on, then save
    await newRow.click();
    await expect(page.getByRole('button', { name: 'Save Roster' })).toBeVisible();
    await page.getByTestId('roster-player-toggle').first().click();
    await page.getByRole('button', { name: 'Save Roster' }).click();

    await expect(newRow).toContainText('1 players', { timeout: 8_000 });
  });
});
