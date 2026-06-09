import { test, expect } from '@playwright/test';
import { createAndLogin, setupTeam } from './helpers';

test.describe('Players', () => {
  test('create a player and it appears in the list', async ({ page }) => {
    await createAndLogin(page, `players-create-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    const teamId = await setupTeam(page, 'Players Create Team');

    await page.getByRole('button', { name: '+ Add Player' }).click();

    // Modal heading confirms we're in the Add Player dialog
    await expect(page.getByRole('heading', { name: 'Add Player' })).toBeVisible();

    await page.getByLabel('First name').fill('John');
    await page.getByLabel('Last name').fill('Doe');
    // Submit label is "Add Player" (same text as button that opened the modal)
    await page.getByRole('button', { name: 'Add Player' }).last().click();

    await expect(page.getByText('John Doe')).toBeVisible({ timeout: 10_000 });

    // Suppress unused variable warning — teamId used to confirm we're on the right page
    void teamId;
  });

  test('CSV import button is visible', async ({ page }) => {
    await createAndLogin(page, `players-csv-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await setupTeam(page, 'CSV Import Team');

    await expect(page.getByRole('button', { name: 'Import CSV' })).toBeVisible();
  });

  test('navigate to player card and see dev tabs', async ({ page }) => {
    await createAndLogin(page, `players-card-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    const teamId = await setupTeam(page, 'Dev Tabs Team');

    // Create a player first
    await page.getByRole('button', { name: '+ Add Player' }).click();
    await page.getByLabel('First name').fill('Dev');
    await page.getByLabel('Last name').fill('Tabber');
    await page.getByRole('button', { name: 'Add Player' }).last().click();
    await page.getByText('Dev Tabber').waitFor();

    // Click on the player name link to navigate to the card
    await page.getByRole('link', { name: 'Dev Tabber' }).click();
    await page.waitForURL(new RegExp(`/teams/${teamId}/players/[^/]+$`));

    // Verify development tracking tabs are present
    await expect(page.getByRole('button', { name: 'Dev Log' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trends' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Goals' })).toBeVisible();
  });

  test('comparison page is accessible', async ({ page }) => {
    await createAndLogin(page, `players-compare-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    const teamId = await setupTeam(page, 'Comparison Team');

    await page.goto(`/teams/${teamId}/players/compare`);
    await page.waitForLoadState('networkidle');

    // Page should render with the "Select up to" instructional text
    await expect(page.getByText(/select up to/i)).toBeVisible({ timeout: 8_000 });
  });
});
