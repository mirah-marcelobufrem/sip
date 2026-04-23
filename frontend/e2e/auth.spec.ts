import { test, expect } from '@playwright/test';

const TEST_EMAIL = `e2e-${Date.now()}@test.invalid`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NAME = 'E2E Tester';

test.describe('Authentication', () => {
  test('register → login → protected redirect', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveTitle(/SIP Scout/);

    await page.getByLabel(/display name/i).fill(TEST_NAME);
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /register|sign up/i }).click();

    await expect(page).toHaveURL(/\/(teams|login)/);
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    await expect(page).toHaveURL(/\/teams/);
  });

  test('redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/teams');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /log in|sign in/i }).click();

    await expect(page.getByRole('alert')).toBeVisible();
  });
});
