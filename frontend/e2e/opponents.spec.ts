import { test, expect } from '@playwright/test';
import { createAndLogin } from './helpers';

test.describe('Opponent Teams', () => {
  test('opponent teams page renders correctly', async ({ page }) => {
    await createAndLogin(page, `opp-render-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.goto('/opponent-teams');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Opponent Teams' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Opponent' })).toBeVisible();
  });

  test('create an opponent team and it appears in the list', async ({ page }) => {
    await createAndLogin(page, `opp-create-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.goto('/opponent-teams');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '+ Add Opponent' }).click();

    // Modal heading is "Add Opponent Team"
    await expect(page.getByRole('heading', { name: 'Add Opponent Team' })).toBeVisible();

    // The label includes an asterisk; use a partial match
    await page.getByLabel(/team name/i).fill('Test Rivals');
    // Submit button is "Add Team"
    await page.getByRole('button', { name: 'Add Team' }).click();

    await expect(page.getByText('Test Rivals')).toBeVisible({ timeout: 10_000 });
  });

  test('clicking an opponent navigates to its profile', async ({ page }) => {
    await createAndLogin(page, `opp-navigate-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.goto('/opponent-teams');
    await page.waitForLoadState('networkidle');

    // Create the opponent first
    await page.getByRole('button', { name: '+ Add Opponent' }).click();
    await page.getByLabel(/team name/i).fill('Navigate Rivals');
    await page.getByRole('button', { name: 'Add Team' }).click();
    await page.getByText('Navigate Rivals').waitFor();

    // Click on the row (avoid the action buttons column)
    const row = page.getByRole('row', { name: /navigate rivals/i });
    await row.getByText('Navigate Rivals').click();

    await page.waitForURL(/\/opponent-teams\/[0-9a-f-]+/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/opponent-teams\/[0-9a-f-]+/);
  });
});
