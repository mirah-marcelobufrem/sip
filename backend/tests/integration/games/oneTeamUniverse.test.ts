import request from 'supertest';
import app from '../../../src/index.js';

/**
 * S08 v5 — One Team Universe (U-01/U-02/U-03) end-state invariants:
 * - R2: every game resolves to two real team ids (no opponent columns)
 * - away (external/scouted) capture: events + box score + possession work
 * - external teams stay ownership-scoped (v1.6.1 semantics preserved)
 * - R7: tournament_teams is the integrity-backed, queryable relation
 */

async function registerAndLogin(suffix = '') {
  const email = `otu-${suffix}${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'OTU User' });
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
    .send({ firstName, lastName: 'OTU', jerseyNumber: jersey });
  return res.body.id as string;
}

describe('S08 v5 — One Team Universe', () => {
  it('R2 — creating a game by opponent name resolves an external away team', async () => {
    const token = await registerAndLogin('name');
    const teamId = await createTeam(token, `OTU Home ${Date.now()}`);

    const gameRes = await request(app)
      .post(`/api/v1/teams/${teamId}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: new Date().toISOString(), awayTeamName: 'River Rivals' });
    expect(gameRes.status).toBe(201);
    expect(gameRes.body.homeTeamId).toBe(teamId);
    expect(gameRes.body.awayTeamId).toBeTruthy();
    // No legacy opponent columns leak into the response
    expect(gameRes.body.awayOpponentTeamId).toBeUndefined();

    // The away team is now a scouted team in the unified universe
    const scouted = await request(app)
      .get('/api/v1/opponent-teams')
      .set('Authorization', `Bearer ${token}`);
    expect(scouted.status).toBe(200);
    expect(scouted.body.some((t: { id: string; name: string }) =>
      t.id === gameRes.body.awayTeamId && t.name === 'River Rivals')).toBe(true);

    // Re-using the same name find-or-creates (no duplicate)
    const game2 = await request(app)
      .post(`/api/v1/teams/${teamId}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: new Date().toISOString(), awayTeamName: 'River Rivals' });
    expect(game2.body.awayTeamId).toBe(gameRes.body.awayTeamId);
  });

  it('records both sides and builds a complete box score with possession', async () => {
    const token = await registerAndLogin('both');
    const homeId = await createTeam(token, `OTU H ${Date.now()}`);
    const awayId = await createTeam(token, `OTU A ${Date.now()}`);
    const homePlayer = await createPlayer(token, homeId, 'Homer', 4);
    const awayPlayer = await createPlayer(token, awayId, 'Visitor', 7);

    const gameRes = await request(app)
      .post(`/api/v1/teams/${homeId}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: new Date().toISOString(), awayTeamId: awayId });
    const gameId = gameRes.body.id as string;

    await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM', playerId: homePlayer, teamId: homeId, xCourt: 0.5, yCourt: 0.3 });
    await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '3PM', playerId: awayPlayer, teamId: awayId });

    const box = await request(app)
      .get(`/api/v1/games/${gameId}/box-score`)
      .set('Authorization', `Bearer ${token}`);
    expect(box.status).toBe(200);
    const rows = box.body as Array<{ playerId: string; playerName: string | null; isHomeTeam: boolean; pts: number }>;

    const homeRow = rows.find((r) => r.playerId === homePlayer);
    const awayRow = rows.find((r) => r.playerId === awayPlayer);
    // Both sides resolve names from the unified players table (U-01)
    expect(homeRow?.playerName).toBe('Homer OTU');
    expect(awayRow?.playerName).toBe('Visitor OTU');
    expect(homeRow?.isHomeTeam).toBe(true);
    expect(awayRow?.isHomeTeam).toBe(false);
    expect(awayRow?.pts).toBe(3); // away can finally score

    // Possession resolves for the away team (no null special-case)
    const gameView = await request(app)
      .get(`/api/v1/games/${gameId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(gameView.body.currentPossessionTeamId).toBeTruthy();
  });

  it('keeps scouted teams private to their creator (v1.6.1 scoping)', async () => {
    const owner = await registerAndLogin('owner');
    const intruder = await registerAndLogin('intruder');
    const homeId = await createTeam(owner, `OTU Priv ${Date.now()}`);

    const gameRes = await request(app)
      .post(`/api/v1/teams/${homeId}/games`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ date: new Date().toISOString(), awayTeamName: 'Secret Scouts' });
    const awayId = gameRes.body.awayTeamId as string;

    const ownerView = await request(app)
      .get(`/api/v1/opponent-teams/${awayId}`)
      .set('Authorization', `Bearer ${owner}`);
    expect(ownerView.status).toBe(200);

    const intruderView = await request(app)
      .get(`/api/v1/opponent-teams/${awayId}`)
      .set('Authorization', `Bearer ${intruder}`);
    expect(intruderView.status).toBe(404); // existence not leaked
  });

  it('R7 — tournament_teams is the integrity-backed, queryable relation', async () => {
    const token = await registerAndLogin('tourney');
    const a = await createTeam(token, `OTU TA ${Date.now()}`);
    const b = await createTeam(token, `OTU TB ${Date.now()}`);

    const tourney = await request(app)
      .post('/api/v1/tournaments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `OTU Cup ${Date.now()}`,
        format: 'single_elimination',
        numTeams: 2,
        teams: [
          { seed: 1, teamId: a, teamName: 'A' },
          { seed: 2, teamId: b, teamName: 'B' },
        ],
      });
    expect(tourney.status).toBe(201);

    const teamsRes = await request(app)
      .get(`/api/v1/tournaments/${tourney.body.id}/teams`)
      .set('Authorization', `Bearer ${token}`);
    expect(teamsRes.status).toBe(200);
    const ids = (teamsRes.body as Array<{ teamId: string; seed: number }>).map((r) => r.teamId).sort();
    expect(ids).toEqual([a, b].sort());
  });
});
