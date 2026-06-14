import { test, expect, type Page } from '@playwright/test';
import { createAndLogin, setupTeam } from './helpers';

/** Registers a user, creates one own team and one opponent team. Returns the team id. */
async function setupTeamWithOpponent(page: Page, suffix: string): Promise<string> {
  await createAndLogin(page, suffix);
  await page.waitForURL(/\/teams/);

  const teamId = await setupTeam(page, `Tourney Squad ${suffix}`);

  // S08 — scouted teams are created from the Teams page "Scouted" tab.
  await page.goto('/teams');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Scouted' }).click();
  await page.getByRole('button', { name: '+ Add Scouted Team' }).click();
  await page.getByLabel(/team name/i).fill(`Tourney Foes ${suffix}`);
  await page.getByRole('button', { name: 'Add Team' }).click();
  await expect(page.getByText(`Tourney Foes ${suffix}`)).toBeVisible({ timeout: 10_000 });

  return teamId;
}

/** Creates a single-elimination tournament from the multi-select, picking teamA (seed 1) and teamB (seed 2). */
async function createTournament(page: Page, name: string, teamA: string, teamB: string) {
  await page.goto('/tournaments');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: '+ New Tournament' }).click();
  await expect(page.getByRole('heading', { name: 'New Tournament' })).toBeVisible();

  await page.getByPlaceholder(/city championship/i).fill(name);

  const teamAButton = page.getByRole('button', { name: teamA, exact: true });
  const teamBButton = page.getByRole('button', { name: teamB, exact: true });
  await expect(teamAButton).toBeVisible({ timeout: 10_000 });
  await expect(teamBButton).toBeVisible();

  await teamAButton.click();
  await teamBButton.click();
  await expect(page.getByText('2 teams selected')).toBeVisible();

  await page.getByRole('button', { name: 'Create Tournament' }).click();
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible({ timeout: 10_000 });
}

test.describe('Tournaments', () => {
  test('creating a tournament via the team multi-select links the bracket to the selected teams', async ({ page }) => {
    const suffix = `tourn-bracket-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await setupTeamWithOpponent(page, suffix);

    const tournamentName = `City Cup ${suffix}`;
    const teamA = `Tourney Squad ${suffix}`;
    const teamB = `Tourney Foes ${suffix}`;

    await createTournament(page, tournamentName, teamA, teamB);

    await page.getByRole('link', { name: tournamentName, exact: true }).click();
    await page.waitForURL(/\/tournaments\/[0-9a-f-]+/);

    await expect(page.getByRole('heading', { name: tournamentName })).toBeVisible();
    await expect(page.getByText(teamA, { exact: true })).toBeVisible();
    await expect(page.getByText(teamB, { exact: true })).toBeVisible();
  });

  test('game wizard tournament dropdown includes tournaments created via the team multi-select', async ({ page }) => {
    const suffix = `tourn-wizard-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const teamId = await setupTeamWithOpponent(page, suffix);

    const tournamentName = `Spring Open ${suffix}`;
    const teamA = `Tourney Squad ${suffix}`;
    const teamB = `Tourney Foes ${suffix}`;

    await createTournament(page, tournamentName, teamA, teamB);

    await page.goto(`/teams/${teamId}/games`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: '+ New Game' }).click();

    await expect(page.getByText('Step 1 of 4')).toBeVisible();
    await page.getByLabel('Opponent / Away Team').fill('Wizard Rivals');

    const tournamentSelect = page.getByLabel('Tournament', { exact: true });
    await expect(tournamentSelect.locator('option', { hasText: tournamentName })).toHaveCount(1);
    await tournamentSelect.selectOption({ label: tournamentName });

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 2 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 3 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Step 4 of 4')).toBeVisible();
    await page.getByRole('button', { name: 'Create Game' }).click();

    await page.waitForURL(/\/games\/[^/]+\/live/, { timeout: 15_000 });

    await page.goto(`/teams/${teamId}/games`);
    await page.waitForLoadState('networkidle');

    const gamesList = page.locator('.space-y-3');
    await expect(gamesList.locator('span.rounded-full', { hasText: tournamentName })).toBeVisible();
  });
});
