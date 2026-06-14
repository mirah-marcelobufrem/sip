import { test, expect } from '@playwright/test';
import { createAndLogin } from './helpers';

/**
 * S08 v5 — scouted (external) teams now live under the Teams page "Scouted"
 * tab (the standalone /opponent-teams listing page was removed). Ownership
 * scoping (v1.6.1) is preserved across the unified team universe.
 */

test.describe('Scouted Teams', () => {
  test('the Scouted tab renders with an add control', async ({ page }) => {
    await createAndLogin(page, `scout-render-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.getByRole('button', { name: 'Scouted' }).click();
    await expect(page.getByRole('button', { name: '+ Add Scouted Team' })).toBeVisible();
  });

  test('create a scouted team and it appears in the Scouted tab', async ({ page }) => {
    await createAndLogin(page, `scout-create-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.getByRole('button', { name: 'Scouted' }).click();
    await page.getByRole('button', { name: '+ Add Scouted Team' }).click();
    await expect(page.getByRole('heading', { name: 'Add Scouted Team' })).toBeVisible();

    const name = `Test Rivals ${Date.now()}`;
    await page.getByLabel(/team name/i).fill(name);
    await page.getByRole('button', { name: 'Add Team' }).click();

    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a scouted team navigates to its profile', async ({ page }) => {
    await createAndLogin(page, `scout-navigate-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.getByRole('button', { name: 'Scouted' }).click();
    const name = `Navigate Rivals ${Date.now()}`;
    await page.getByRole('button', { name: '+ Add Scouted Team' }).click();
    await page.getByLabel(/team name/i).fill(name);
    await page.getByRole('button', { name: 'Add Team' }).click();
    await page.getByText(name).waitFor();

    await page.getByText(name).click();
    await page.waitForURL(/\/opponent-teams\/[0-9a-f-]+/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/opponent-teams\/[0-9a-f-]+/);
  });

  test('scouted teams are private to the creating user', async ({ page, browser }) => {
    await createAndLogin(page, `scout-owner-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.getByRole('button', { name: 'Scouted' }).click();
    const name = `Private Rivals ${Date.now()}`;
    await page.getByRole('button', { name: '+ Add Scouted Team' }).click();
    await page.getByLabel(/team name/i).fill(name);
    await page.getByRole('button', { name: 'Add Team' }).click();
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

    // A second, unrelated user must not see this scouted team
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await createAndLogin(otherPage, `scout-stranger-${Date.now()}`);
    await otherPage.waitForURL(/\/teams/);
    await otherPage.getByRole('button', { name: 'Scouted' }).click();
    await otherPage.waitForLoadState('networkidle');

    await expect(otherPage.getByText(name)).not.toBeVisible();
    await otherContext.close();
  });
});
