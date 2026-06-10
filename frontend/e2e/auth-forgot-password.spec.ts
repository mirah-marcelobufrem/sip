import { test, expect } from '@playwright/test';

test.describe('Forgot Password', () => {
  test('forgot-password page renders', async ({ page }) => {
    await page.goto('/forgot-password');
    // h2 heading inside the card
    await expect(page.getByRole('heading', { name: 'Forgot password' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible();
  });

  test('submitting forgot-password shows success state', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email address').fill('someone@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    // Backend always returns 200; success message should appear
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
  });

  test('reset-password page renders without a token', async ({ page }) => {
    await page.goto('/reset-password');
    // Without a token query param the page shows an error state with a link back
    await expect(page.getByText(/invalid or missing reset token/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /request new link/i })).toBeVisible();
  });

  test('back to login link works', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('link', { name: /back to login/i }).click();
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });
});
