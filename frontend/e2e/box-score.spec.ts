import { test, expect } from '@playwright/test';

test.describe('Box Score (navigation smoke test)', () => {
  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/games/nonexistent/box-score');
    await expect(page).toHaveURL(/\/login/);
  });

  test('teams page loads after login', async ({ page }) => {
    const email = `e2e-boxscore-${Date.now()}@test.invalid`;
    await page.goto('/register');
    await page.getByLabel(/display name/i).fill('Box Tester');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('TestPass123!');
    await page.getByRole('button', { name: /register|sign up/i }).click();
    await page.waitForURL(/\/(teams|login)/);

    if (page.url().includes('/teams')) {
      await expect(page.getByText(/teams|create.*team/i)).toBeVisible();
    }
  });
});
