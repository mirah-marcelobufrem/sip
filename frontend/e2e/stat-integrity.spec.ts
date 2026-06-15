import { test, expect, type Page } from '@playwright/test';
import { createAndLogin, setupTeam } from './helpers';

/**
 * S07 v5 (Stat Integrity Quick Wins) E2E:
 * - N-01 stint-derived minutes + per-player plus/minus on the box score
 * - N-03/N-04 team stats strip (four factors + scoring-context metrics)
 * - N-05 zone efficiency table on the shot map
 * - N-12 language selector hidden; units selector remains
 * - N-13 per-40/per-36 normalization control on the season box score
 */

/**
 * Register, create a team + one player, create a game via the wizard WITH the
 * player toggled as a starter in Step 3 (the stint engine needs an initial
 * lineup), then start the game.
 */
async function setupLiveGameWithStarter(page: Page, suffix: string): Promise<string> {
  await createAndLogin(page, suffix);
  await page.waitForURL(/\/teams/);

  const teamId = await setupTeam(page, `Integrity Team ${suffix}`);

  await page.getByRole('button', { name: '+ Add Player' }).click();
  await expect(page.getByRole('heading', { name: 'Add Player' })).toBeVisible();
  await page.getByLabel('First name').fill('Stat');
  await page.getByLabel('Last name').fill('Tracker');
  await page.getByRole('button', { name: 'Add Player' }).last().click();
  await expect(page.getByText('Stat Tracker')).toBeVisible({ timeout: 10_000 });

  await page.goto(`/teams/${teamId}/games`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '+ New Game' }).click();

  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await page.getByLabel('Opponent / Away Team').fill('Integrity Rivals');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3 — the player is auto on the default roster's game-day list; mark it
  // a starter (S09 flow) so the initial lineup is recorded for the stint engine.
  await expect(page.getByText('Step 3 of 4')).toBeVisible();
  await page.getByTestId('starter-toggle').first().click();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Step 4 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Create Game' }).click();

  await page.waitForURL(/\/games\/[^/]+\/live/, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByRole('button', { name: 'Shot' })).toBeVisible({ timeout: 10_000 });

  return teamId;
}

/** Taps the court picker SVG at a fraction of its width/height (basket at top). */
async function tapCourt(page: Page, fx: number, fy: number) {
  const svg = page.locator('svg.cursor-crosshair');
  await expect(svg).toBeVisible();
  const box = await svg.boundingBox();
  if (!box) throw new Error('Court picker SVG has no bounding box');
  await svg.click({ position: { x: box.width * fx, y: box.height * fy } });
}

test.describe('Stat integrity — S07 v5', () => {
  test('box score shows stint minutes, plus/minus and the team stats strip', async ({ page }) => {
    await setupLiveGameWithStarter(page, `integ-box-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    const gameId = page.url().match(/\/games\/([^/]+)\/live/)![1];

    // One made free throw by the starter (single-tap stat, no court picker)
    await page.getByRole('button', { name: 'FT Made' }).click();
    await page.getByRole('button', { name: /Tracker/ }).click();
    await expect(page.getByRole('button', { name: 'Log (1)' })).toBeVisible({ timeout: 10_000 });

    await page.goto(`/games/${gameId}/box-score`);
    const row = page.getByRole('row').filter({ hasText: 'Tracker' });
    await expect(row).toHaveCount(1);

    // N-01 — MIN: starter with events only in period 1 of a 4×10 game → "10"
    await expect(row.getByRole('cell').nth(1)).toHaveText('10');
    // N-01 — plus/minus: +1 while on court
    await expect(row.getByRole('cell').last()).toHaveText('+1');

    // N-03/N-04 — the team stats strip renders with the metric chips
    const strip = page.getByTestId('team-stats-strip');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('eFG%');
    await expect(strip).toContainText('PIP');
    await expect(strip).toContainText('PPP');
  });

  test('shot map shows the zone efficiency table after a located shot', async ({ page }) => {
    await setupLiveGameWithStarter(page, `integ-zone-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    const gameId = page.url().match(/\/games\/([^/]+)\/live/)![1];

    // Consolidated shot flow: Shot → player → court tap near the basket → MADE
    await page.getByRole('button', { name: 'Shot' }).click();
    await page.getByRole('button', { name: /Tracker/ }).click();
    await expect(page.getByText('Tap the shot location')).toBeVisible();
    await tapCourt(page, 0.5, 0.2);
    await page.getByRole('button', { name: /^MADE$/ }).click();
    await expect(page.getByRole('button', { name: 'Log (1)' })).toBeVisible({ timeout: 10_000 });

    await page.goto(`/games/${gameId}/shots`);
    const zoneTable = page.getByTestId('zone-efficiency-table');
    await expect(zoneTable).toBeVisible({ timeout: 10_000 });
    // A tap near the basket lands in the restricted area; 1 of 1 made
    await expect(zoneTable).toContainText('Restricted Area');
    await expect(zoneTable).toContainText('1/1');
    await expect(zoneTable).toContainText('Total');
  });

  test('settings hides the language selector; season box score offers per-40/per-36', async ({ page }) => {
    await createAndLogin(page, `integ-settings-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
    const teamId = await setupTeam(page, `Integrity Settings ${Date.now()}`);

    // N-12 — language selector gone, units selector still present
    await page.goto('/settings');
    await expect(page.getByText('Units')).toBeVisible();
    await expect(page.getByText('Language', { exact: true })).toHaveCount(0);

    // N-13 — normalization control present on the season box score page
    await page.goto(`/teams/${teamId}/season-box-score`);
    await expect(page.getByRole('button', { name: 'Per 40' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Per 36' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Off', exact: true })).toBeVisible();
  });
});
