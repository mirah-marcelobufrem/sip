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

    // Unique name: opponent teams are currently visible across users, so
    // fixed names collide with rows left by earlier runs (strict mode).
    const name = `Test Rivals ${Date.now()}`;
    // The label includes an asterisk; use a partial match
    await page.getByLabel(/team name/i).fill(name);
    // Submit button is "Add Team"
    await page.getByRole('button', { name: 'Add Team' }).click();

    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  test('clicking an opponent navigates to its profile', async ({ page }) => {
    await createAndLogin(page, `opp-navigate-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.goto('/opponent-teams');
    await page.waitForLoadState('networkidle');

    // Create the opponent first (unique name — see note in the create test)
    const name = `Navigate Rivals ${Date.now()}`;
    await page.getByRole('button', { name: '+ Add Opponent' }).click();
    await page.getByLabel(/team name/i).fill(name);
    await page.getByRole('button', { name: 'Add Team' }).click();
    await page.getByText(name).waitFor();

    // Click on the row (avoid the action buttons column)
    const row = page.getByRole('row', { name });
    await row.getByText(name).click();

    await page.waitForURL(/\/opponent-teams\/[0-9a-f-]+/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/opponent-teams\/[0-9a-f-]+/);
  });
});
