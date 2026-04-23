import { test, expect } from '@playwright/test';

const TEST_EMAIL = `e2e-settings-${Date.now()}@test.invalid`;
const TEST_PASSWORD = 'TestPass123!';

async function loginOrRegister(page: import('@playwright/test').Page) {
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill('Settings Tester');
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /register|sign up/i }).click();
  await page.waitForURL(/\/(teams|login)/);
  if (page.url().includes('/login')) {
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/teams/);
  }
}

test.describe('Settings', () => {
  test('settings page renders all sections', async ({ page }) => {
    await loginOrRegister(page);
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    await expect(page.getByText(/general/i)).toBeVisible();
    await expect(page.getByText(/appearance/i)).toBeVisible();
    await expect(page.getByText(/game recording/i)).toBeVisible();
    await expect(page.getByText(/notifications/i)).toBeVisible();
  });

  test('can toggle advanced stats setting', async ({ page }) => {
    await loginOrRegister(page);
    await page.goto('/settings');

    const toggle = page.getByRole('switch', { name: /advanced stats/i });
    await expect(toggle).toBeVisible();
    const initialState = await toggle.getAttribute('aria-checked');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', initialState === 'true' ? 'false' : 'true');
  });

  test('can change theme', async ({ page }) => {
    await loginOrRegister(page);
    await page.goto('/settings');

    const themeSelect = page.locator('select').nth(0);
    await themeSelect.selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('Account', () => {
  test('account page has export and delete buttons', async ({ page }) => {
    await loginOrRegister(page);
    await page.goto('/account');

    await expect(page.getByRole('heading', { name: /account/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /download my data/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /delete my account/i })).toBeVisible();
  });

  test('delete account requires confirmation text', async ({ page }) => {
    await loginOrRegister(page);
    await page.goto('/account');

    await page.getByRole('button', { name: /delete my account/i }).click();
    const confirmBtn = page.getByRole('button', { name: /confirm deletion/i });
    await expect(confirmBtn).toBeDisabled();

    await page.getByPlaceholder('DELETE').fill('DELETE');
    await expect(confirmBtn).toBeEnabled();
  });
});
