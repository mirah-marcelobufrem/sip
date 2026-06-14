import { test, expect, type Page } from '@playwright/test';
import { createAndLogin, setupTeam } from './helpers';

/**
 * S05 (FIBA Phase 2) live recording E2E:
 * - I-02 auto 2/3 classification banner + Override in the court picker
 * - F-01 possession arrow indicator on the live scoreboard
 *
 * NOTE: since S08 (One Team Universe) games created through the wizard always
 * have a real away team (an external/scouted team find-or-created from the
 * typed name), so possession resolves for BOTH sides. A made home shot now
 * flips possession to the away team and the arrow stays visible ("AWAY BALL").
 */

/** Register, create team + one player, create a game via the wizard, start it. */
async function setupLiveGame(page: Page, suffix: string) {
  await createAndLogin(page, suffix);
  await page.waitForURL(/\/teams/);

  const teamId = await setupTeam(page, `Live Team ${suffix}`);

  // Add a player on the roster page (players.spec.ts flow)
  await page.getByRole('button', { name: '+ Add Player' }).click();
  await expect(page.getByRole('heading', { name: 'Add Player' })).toBeVisible();
  await page.getByLabel('First name').fill('Liv');
  await page.getByLabel('Last name').fill('Recorder');
  await page.getByRole('button', { name: 'Add Player' }).last().click();
  await expect(page.getByText('Liv Recorder')).toBeVisible({ timeout: 10_000 });

  // Create a game through the 4-step wizard (games.spec.ts flow)
  await page.goto(`/teams/${teamId}/games`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '+ New Game' }).click();

  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await page.getByLabel('Opponent / Away Team').fill('Possession Rivals');
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Step 2 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Step 3 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  await expect(page.getByText('Step 4 of 4')).toBeVisible();
  await page.getByRole('button', { name: 'Create Game' }).click();

  await page.waitForURL(/\/games\/[^/]+\/live/, { timeout: 15_000 });

  // Start the game and wait for the live recording UI
  await page.getByRole('button', { name: 'Start Game' }).click();
  await expect(page.getByRole('button', { name: 'Shot' })).toBeVisible({ timeout: 10_000 });
}

/**
 * Taps the court picker SVG at a fraction of its width/height.
 * The picker renders the basket at the TOP (display y ≈ 0.113):
 * - near the basket (fy ≈ 0.2) → 2-point area
 * - deep court (fy ≈ 0.85)     → 3-point area
 */
async function tapCourt(page: Page, fx: number, fy: number) {
  const svg = page.locator('svg.cursor-crosshair');
  await expect(svg).toBeVisible();
  const box = await svg.boundingBox();
  if (!box) throw new Error('Court picker SVG has no bounding box');
  await svg.click({ position: { x: box.width * fx, y: box.height * fy } });
}

test.describe('Live recording — S05 FIBA Phase 2', () => {
  test('court picker auto-classifies 2pt vs 3pt and Override flips the banner', async ({ page }) => {
    await setupLiveGame(page, `live-class-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

    // Select the consolidated Shot button, then the player → court picker opens
    await page.getByRole('button', { name: 'Shot' }).click();
    await page.getByRole('button', { name: /Recorder/ }).click();
    await expect(page.getByText('Tap the shot location')).toBeVisible();

    const banner = page.getByTestId('shot-classification-banner');

    // Tap near the basket (top of the rendered court) → 2-point shot
    await tapCourt(page, 0.5, 0.2);
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('2-POINT SHOT');

    // Override flips the classification deterministically, and flips back
    await page.getByRole('button', { name: 'Override' }).click();
    await expect(banner).toContainText('3-POINT SHOT');
    await page.getByRole('button', { name: 'Override' }).click();
    await expect(banner).toContainText('2-POINT SHOT');

    // Re-tap deep in the court → auto-reclassified as a 3-point shot
    await tapCourt(page, 0.5, 0.85);
    await expect(banner).toContainText('3-POINT SHOT');

    // MADE confirms the shot with the derived stat type (3PM)
    await page.getByRole('button', { name: /^MADE$/ }).click();

    // Picker closes and the event lands in the game log
    await expect(banner).toBeHidden();
    await expect(page.getByRole('button', { name: 'Log (1)' })).toBeVisible({ timeout: 10_000 });
  });

  test('possession arrow appears once the home team gains possession', async ({ page }) => {
    await setupLiveGame(page, `live-poss-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

    const arrow = page.getByTestId('possession-arrow');

    // No possession recorded yet → indicator renders nothing
    await expect(arrow).toHaveCount(0);

    // Defensive rebound by the home player → home team gains possession
    await page.getByRole('button', { name: 'DReb' }).click();
    await page.getByRole('button', { name: /Recorder/ }).click();
    await expect(arrow).toBeVisible({ timeout: 10_000 });
    await expect(arrow).toContainText('HOME BALL');

    // Record a made 2-pointer through the court picker
    await page.getByRole('button', { name: 'Shot' }).click();
    await page.getByRole('button', { name: /Recorder/ }).click();
    await expect(page.getByText('Tap the shot location')).toBeVisible();
    await tapCourt(page, 0.5, 0.2);
    await expect(page.getByTestId('shot-classification-banner')).toContainText('2-POINT SHOT');
    await page.getByRole('button', { name: /^MADE$/ }).click();

    // Both events recorded
    await expect(page.getByRole('button', { name: 'Log (2)' })).toBeVisible({ timeout: 10_000 });

    // S08 — the away team is now a real (external) team, so a made home shot
    // flips possession to the AWAY side; the indicator stays visible and
    // points away. (Pre-S08 the unmanaged opponent resolved to null possession
    // and the arrow hid — that hole is closed.)
    await expect(arrow).toBeVisible({ timeout: 10_000 });
    await expect(arrow).toContainText('AWAY BALL');
  });
});
