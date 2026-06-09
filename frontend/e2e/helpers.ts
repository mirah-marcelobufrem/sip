import type { Page } from '@playwright/test';

/**
 * Registers a unique user and lands on /teams.
 * Returns { email, password } for reuse within the same test file.
 */
export async function createAndLogin(page: Page, suffix = Date.now().toString()) {
  const email = `e2e-${suffix}@test.invalid`;
  const password = 'TestPass123!';
  await page.goto('/register');
  await page.getByLabel(/display name/i).fill(`Tester ${suffix}`);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /register|sign up/i }).click();
  await page.waitForURL(/\/(teams|login)/);
  if (page.url().includes('/login')) {
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await page.waitForURL(/\/teams/);
  }
  return { email, password };
}

/**
 * Creates a team, navigates to its Roster page, returns the teamId from the URL.
 * Assumes the user is already logged in (any page is fine).
 */
export async function setupTeam(page: Page, teamName: string): Promise<string> {
  await page.goto('/teams');
  await page.getByRole('button', { name: /\+ New Team/i }).click();
  await page.getByLabel(/team name/i).fill(teamName);
  await page.getByRole('button', { name: /^Create$/i }).click();
  // Wait for the modal to close and the team card to appear
  await page.getByText(teamName).waitFor();
  // Click the Roster link on the newly created team card
  const teamCard = page.locator('div').filter({ hasText: teamName }).first();
  await teamCard.getByText('Roster').click();
  await page.waitForURL(/\/teams\/[^/]+\/players/);
  const match = page.url().match(/\/teams\/([^/]+)\/players/);
  return match![1];
}
