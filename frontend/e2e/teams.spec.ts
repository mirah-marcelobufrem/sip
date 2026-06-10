import { test, expect } from '@playwright/test';
import { createAndLogin } from './helpers';

test.describe('Teams', () => {
  test('create a team and it appears in the list', async ({ page }) => {
    await createAndLogin(page, `teams-create-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.getByRole('button', { name: /\+ New Team/i }).click();
    await page.getByLabel(/team name/i).fill('E2E Warriors');
    await page.getByRole('button', { name: /^Create$/i }).click();

    await expect(page.getByText('E2E Warriors')).toBeVisible({ timeout: 10_000 });
  });

  test('team card has roster, games, analytics, members buttons', async ({ page }) => {
    await createAndLogin(page, `teams-card-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    // Create a team so there is something to inspect
    await page.getByRole('button', { name: /\+ New Team/i }).click();
    await page.getByLabel(/team name/i).fill('Card Check FC');
    await page.getByRole('button', { name: /^Create$/i }).click();
    await page.getByText('Card Check FC').waitFor();

    // Find the card and verify all action links/buttons
    const card = page.locator('div').filter({ hasText: 'Card Check FC' }).first();
    await expect(card.getByText('Roster')).toBeVisible();
    await expect(card.getByText('Games')).toBeVisible();
    await expect(card.getByText('Analytics')).toBeVisible();
    await expect(card.getByText('Members')).toBeVisible();
  });

  test('members button opens the members modal', async ({ page }) => {
    await createAndLogin(page, `teams-members-${Date.now()}`);
    await page.waitForURL(/\/teams/);

    await page.getByRole('button', { name: /\+ New Team/i }).click();
    await page.getByLabel(/team name/i).fill('Members Modal Team');
    await page.getByRole('button', { name: /^Create$/i }).click();
    await page.getByText('Members Modal Team').waitFor();

    const card = page.locator('div').filter({ hasText: 'Members Modal Team' }).first();
    await card.getByRole('button', { name: 'Members' }).click();

    // Modal heading should appear
    await expect(page.getByRole('heading', { name: 'Team Members' })).toBeVisible({ timeout: 8_000 });
  });
});
