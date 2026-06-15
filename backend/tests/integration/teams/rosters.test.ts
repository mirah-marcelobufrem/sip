import request from 'supertest';
import app from '../../../src/index.js';

/**
 * S09 v5 — Rosters & Eligibility (U-04 / R3–R6):
 * - rosters CRUD under /teams/:teamId/rosters (+ membership)
 * - R6: a player may only join a roster of their OWN team
 * - a default "Full Squad" roster is auto-created with the team's players
 * - createGame defaults game sides to each team's default roster
 * - season-stats surfaces gamesOnRoster + dnp from the game roster
 */

async function registerAndLogin(suffix = '') {
  const email = `roster-${suffix}${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Roster User' });
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeam(token: string, name: string) {
  const res = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  return res.body.id as string;
}

async function createPlayer(token: string, teamId: string, firstName: string, jersey: number) {
  const res = await request(app)
    .post(`/api/v1/teams/${teamId}/players`)
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName, lastName: 'R', jerseyNumber: jersey });
  return res.body.id as string;
}

describe('S09 v5 — Rosters & Eligibility', () => {
  it('auto-creates a default "Full Squad" roster containing the team players', async () => {
    const token = await registerAndLogin('default');
    const teamId = await createTeam(token, `Roster Home ${Date.now()}`);
    const p1 = await createPlayer(token, teamId, 'Alpha', 1);
    const p2 = await createPlayer(token, teamId, 'Bravo', 2);

    const res = await request(app)
      .get(`/api/v1/teams/${teamId}/rosters`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const def = res.body.find((r: { isDefault: boolean }) => r.isDefault);
    expect(def).toBeTruthy();
    expect(def.name).toBe('Full Squad');
    expect(new Set(def.playerIds)).toEqual(new Set([p1, p2]));
  });

  it('creates a roster, edits membership, and enforces R6 across teams', async () => {
    const token = await registerAndLogin('crud');
    const teamA = await createTeam(token, `A ${Date.now()}`);
    const teamB = await createTeam(token, `B ${Date.now()}`);
    const aPlayer = await createPlayer(token, teamA, 'Mine', 10);
    const bPlayer = await createPlayer(token, teamB, 'Theirs', 11);

    const created = await request(app)
      .post(`/api/v1/teams/${teamA}/rosters`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Travel Squad', playerIds: [aPlayer] });
    expect(created.status).toBe(201);
    const rosterId = created.body.id as string;

    // R6 — adding a player from another team is rejected (FORBIDDEN)
    const forbidden = await request(app)
      .post(`/api/v1/teams/${teamA}/rosters/${rosterId}/players`)
      .set('Authorization', `Bearer ${token}`)
      .send({ playerId: bPlayer });
    expect(forbidden.status).toBe(403);

    // Replacing the full set with a foreign player is also rejected
    const badSet = await request(app)
      .put(`/api/v1/teams/${teamA}/rosters/${rosterId}/players`)
      .set('Authorization', `Bearer ${token}`)
      .send({ playerIds: [aPlayer, bPlayer] });
    expect(badSet.status).toBe(403);

    // The roster still has only the valid player
    const fetched = await request(app)
      .get(`/api/v1/teams/${teamA}/rosters/${rosterId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(fetched.body.playerIds).toEqual([aPlayer]);

    // Removing a player works
    const removed = await request(app)
      .delete(`/api/v1/teams/${teamA}/rosters/${rosterId}/players/${aPlayer}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(204);
    const after = await request(app)
      .get(`/api/v1/teams/${teamA}/rosters/${rosterId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.playerIds).toEqual([]);
  });

  it('createGame defaults home/away sides to the teams default rosters', async () => {
    const token = await registerAndLogin('game');
    const homeId = await createTeam(token, `GH ${Date.now()}`);
    const awayId = await createTeam(token, `GA ${Date.now()}`);
    await createPlayer(token, homeId, 'H', 4);
    await createPlayer(token, awayId, 'A', 7);

    const homeRosters = await request(app)
      .get(`/api/v1/teams/${homeId}/rosters`)
      .set('Authorization', `Bearer ${token}`);
    const homeDefault = homeRosters.body.find((r: { isDefault: boolean }) => r.isDefault).id;

    const gameRes = await request(app)
      .post(`/api/v1/teams/${homeId}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: new Date().toISOString(), awayTeamId: awayId });
    expect(gameRes.status).toBe(201);
    expect(gameRes.body.homeRosterId).toBe(homeDefault);
    expect(gameRes.body.awayRosterId).toBeTruthy();
  });

  it('season-stats reports gamesOnRoster and dnp for a rostered player who did not play', async () => {
    const token = await registerAndLogin('dnp');
    const homeId = await createTeam(token, `DNP H ${Date.now()}`);
    const awayId = await createTeam(token, `DNP A ${Date.now()}`);
    const scorer = await createPlayer(token, homeId, 'Scorer', 5);
    const benchWarmer = await createPlayer(token, homeId, 'Bench', 6);
    await createPlayer(token, awayId, 'Opp', 9);

    const gameRes = await request(app)
      .post(`/api/v1/teams/${homeId}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: new Date().toISOString(), awayTeamId: awayId });
    const gameId = gameRes.body.id as string;

    // Only the scorer records an action; the bench warmer is on the roster but DNP.
    await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM', playerId: scorer, teamId: homeId, xCourt: 0.5, yCourt: 0.3 });

    await request(app)
      .post(`/api/v1/games/${gameId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ finalScoreHome: 2, finalScoreAway: 0 });

    const stats = await request(app)
      .get(`/api/v1/teams/${homeId}/players/season-stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(stats.status).toBe(200);
    const rows = stats.body as Array<{ player: { id: string }; gamesPlayed: number; gamesOnRoster: number; dnp: number }>;

    const scorerRow = rows.find((r) => r.player.id === scorer);
    const benchRow = rows.find((r) => r.player.id === benchWarmer);
    expect(scorerRow?.gamesPlayed).toBe(1);
    expect(scorerRow?.gamesOnRoster).toBe(1);
    expect(scorerRow?.dnp).toBe(0);
    // Bench warmer was rostered but never played → DNP, still returned
    expect(benchRow).toBeTruthy();
    expect(benchRow?.gamesPlayed).toBe(0);
    expect(benchRow?.gamesOnRoster).toBe(1);
    expect(benchRow?.dnp).toBe(1);
  });

  it('returns 404 when fetching a roster that belongs to a different team', async () => {
    const token = await registerAndLogin('mismatch');
    const teamA = await createTeam(token, `MA ${Date.now()}`);
    const teamB = await createTeam(token, `MB ${Date.now()}`);
    const created = await request(app)
      .post(`/api/v1/teams/${teamA}/rosters`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Belongs to A' });
    const rosterId = created.body.id as string;

    // Same user, but the roster is not under teamB's path.
    const res = await request(app)
      .get(`/api/v1/teams/${teamB}/rosters/${rosterId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
