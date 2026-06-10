import { test, expect } from '@playwright/test';
import { createAndLogin } from './helpers';

test.describe('Navigation', () => {
  test('sidebar contains expected nav items', async ({ page }) => {
    await createAndLogin(page, `nav-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    // Open sidebar via the hamburger button
    await page.getByRole('button', { name: /toggle navigation menu/i }).click();

    // Sidebar nav items should now be visible
    await expect(page.getByRole('link', { name: /^Teams$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Opponents$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Scouting$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Tournaments$/i })).toBeVisible();
  });

  test('can navigate to settings from sidebar', async ({ page }) => {
    await createAndLogin(page, `nav-settings-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    // Open sidebar
    await page.getByRole('button', { name: /toggle navigation menu/i }).click();
    await page.getByRole('link', { name: /^Settings$/i }).click();

    await page.waitForURL(/\/settings/);
    await expect(page).toHaveURL(/\/settings/);
  });

  test('can navigate to opponent-teams', async ({ page }) => {
    await createAndLogin(page, `nav-opp-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.goto('/opponent-teams');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'Opponent Teams' })).toBeVisible();
  });
});
