import { test, expect, type Page } from '@playwright/test';
import { createAndLogin, setupTeam } from './helpers';

/**
 * S06 (FIBA Phase 3) live recording E2E:
 * - I-06 team-foul counter + BONUS badge (5th team foul of the period)
 * - I-05 team rebounds (credited to the team, never to a player)
 *
 * Games created through the wizard have an UNMANAGED opponent (free-text name,
 * no away teamId), so all fouls/rebounds here are recorded for the HOME side.
 */

/** Register, create team + one player, create a game via the wizard, start it. */
async function setupLiveGame(page: Page, suffix: string) {
  await createAndLogin(page, suffix);
  await page.waitForURL(/\/teams/);

  const teamId = await setupTeam(page, `Bonus Team ${suffix}`);

  // Add a player on the roster page (players.spec.ts flow)
  await page.getByRole('button', { name: '+ Add Player' }).click();
  await expect(page.getByRole('heading', { name: 'Add Player' })).toBeVisible();
  await page.getByLabel('First name').fill('Bo');
  await page.getByLabel('Last name').fill('Tracker');
  await page.getByRole('button', { name: 'Add Player' }).last().click();
  await expect(page.getByText('Bo Tracker')).toBeVisible({ timeout: 10_000 });

  // Create a game through the 4-step wizard (games.spec.ts flow)
  await page.goto(`/teams/${teamId}/games`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '+ New Game' }).click();

  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  await page.getByLabel('Opponent / Away Team').fill('Bonus Rivals');
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

test.describe('Live recording — S06 FIBA Phase 3', () => {
  test('home team enters the bonus after the 5th personal foul of the period', async ({ page }) => {
    await setupLiveGame(page, `live-bonus-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

    // Initial state: 0 team fouls, no BONUS badge on either side
    await expect(page.getByTestId('home-team-fouls')).toHaveText('0 fouls');
    await expect(page.getByTestId('away-team-fouls')).toHaveText('0 fouls');
    await expect(page.getByTestId('home-bonus')).toHaveCount(0);

    // Record 5 personal fouls for the home roster player.
    // Each event closes the stat selection, so re-select Foul each time and
    // wait for the log counter to acknowledge the write before continuing.
    for (let i = 1; i <= 5; i++) {
      await page.getByRole('button', { name: 'Foul', exact: true }).click();
      await page.getByRole('button', { name: /Tracker/ }).click();
      await expect(page.getByRole('button', { name: `Log (${i})` })).toBeVisible({
        timeout: 10_000,
      });

      if (i === 4) {
        // One foul short of the bonus: counter shows 4, badge not shown yet
        await expect(page.getByTestId('home-team-fouls')).toHaveText('4 fouls', {
          timeout: 10_000,
        });
        await expect(page.getByTestId('home-bonus')).toHaveCount(0);
      }
    }

    // 5th foul → BONUS badge replaces the foul counter on the home side only
    await expect(page.getByTestId('home-bonus')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('home-bonus')).toHaveText('BONUS');
    await expect(page.getByTestId('home-team-fouls')).toHaveCount(0);
    await expect(page.getByTestId('away-team-fouls')).toHaveText('0 fouls');
    await expect(page.getByTestId('away-bonus')).toHaveCount(0);
  });

  test('team rebound is recorded without a player and shows in the game log', async ({ page }) => {
    await setupLiveGame(page, `live-teamreb-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);

    const gameId = page.url().match(/\/games\/([^/]+)\/live/)![1];

    // Open the team rebound panel and record a defensive team rebound (Home)
    await page.getByTestId('team-rebound-btn').click();
    const drebButton = page.getByTestId('team-rebound-dreb');
    await expect(drebButton).toBeVisible();

    // Capture the POST so a backend rejection surfaces directly in the failure
    const [eventResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes(`/games/${gameId}/events`) && r.request().method() === 'POST',
      ),
      drebButton.click(),
    ]);
    expect(
      eventResponse.status(),
      `POST /events team rebound must succeed — got ${eventResponse.status()}: ${await eventResponse.text()}`,
    ).toBe(201);

    // Success path: the panel closes and the event lands in the log counter
    await expect(drebButton).toBeHidden({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Log (1)' })).toBeVisible({ timeout: 10_000 });

    // The game log page shows the DREB credited to HOME with no player name
    await page.goto(`/games/${gameId}/log`);
    const drebRow = page.getByRole('row').filter({ hasText: 'DREB' });
    await expect(drebRow).toHaveCount(1);
    await expect(drebRow.getByRole('cell').nth(1)).toHaveText('HOME');
    await expect(drebRow.getByRole('cell').nth(2)).toHaveText('—');
  });
});
