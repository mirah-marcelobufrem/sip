import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `gametourn-${suffix}${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Game Tournament User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeam(token: string) {
  const teamRes = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Game Tourn Team ${Date.now()}` });
  return teamRes.body.id as string;
}

async function createGame(token: string, teamId: string, body: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/v1/teams/${teamId}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({ date: new Date().toISOString(), ...body });
}

describe('Game <-> Tournament link (default Friendly tournament)', () => {
  it('assigns a default Friendly tournament when no tournamentId is provided', async () => {
    const token = await registerAndLogin('default');
    const teamId = await createTeam(token);

    const gameRes = await createGame(token, teamId);
    expect(gameRes.status).toBe(201);
    expect(gameRes.body.tournamentId).toBeTruthy();

    const tournamentsRes = await request(app)
      .get(`/api/v1/teams/${teamId}/tournaments`)
      .set('Authorization', `Bearer ${token}`);
    expect(tournamentsRes.status).toBe(200);
    const friendly = (tournamentsRes.body as Array<{ id: string; name: string }>).find(
      (t) => t.name === 'Friendly',
    );
    expect(friendly).toBeDefined();
    expect(friendly!.id).toBe(gameRes.body.tournamentId);
  });

  it('reuses the same Friendly tournament across multiple games for the same team', async () => {
    const token = await registerAndLogin('reuse');
    const teamId = await createTeam(token);

    const game1 = await createGame(token, teamId);
    const game2 = await createGame(token, teamId);

    expect(game1.body.tournamentId).toBeTruthy();
    expect(game2.body.tournamentId).toBe(game1.body.tournamentId);

    const tournamentsRes = await request(app)
      .get(`/api/v1/teams/${teamId}/tournaments`)
      .set('Authorization', `Bearer ${token}`);
    const friendlyEntries = (tournamentsRes.body as Array<{ id: string; name: string }>).filter(
      (t) => t.name === 'Friendly',
    );
    expect(friendlyEntries).toHaveLength(1);
  });

  it('uses an explicit tournamentId as-is when provided', async () => {
    const token = await registerAndLogin('explicit');
    const teamId = await createTeam(token);

    // Auto-create the Friendly tournament via a first game
    const game1 = await createGame(token, teamId);
    const friendlyTournamentId = game1.body.tournamentId as string;

    const game2 = await createGame(token, teamId, { tournamentId: friendlyTournamentId });
    expect(game2.status).toBe(201);
    expect(game2.body.tournamentId).toBe(friendlyTournamentId);
  });

  it('filters games by tournamentId via query param', async () => {
    const token = await registerAndLogin('filter');
    const teamId = await createTeam(token);

    const game1 = await createGame(token, teamId);
    const friendlyTournamentId = game1.body.tournamentId as string;

    const otherTournamentRes = await request(app)
      .post('/api/v1/tournaments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Other Tournament ${Date.now()}`,
        format: 'single_elimination',
        numTeams: 2,
        teams: [
          { seed: 1, teamName: 'A' },
          { seed: 2, teamName: 'B' },
        ],
      });
    const otherTournamentId = otherTournamentRes.body.id as string;

    const game2 = await createGame(token, teamId, { tournamentId: otherTournamentId });
    expect(game2.body.tournamentId).toBe(otherTournamentId);

    const filteredRes = await request(app)
      .get(`/api/v1/teams/${teamId}/games`)
      .query({ tournamentId: friendlyTournamentId })
      .set('Authorization', `Bearer ${token}`);
    expect(filteredRes.status).toBe(200);
    const ids = (filteredRes.body as Array<{ id: string; tournamentId: string }>).map((g) => g.id);
    expect(ids).toContain(game1.body.id);
    expect(ids).not.toContain(game2.body.id);
    for (const g of filteredRes.body as Array<{ tournamentId: string }>) {
      expect(g.tournamentId).toBe(friendlyTournamentId);
    }
  });

  it('does not leak per-team Friendly tournaments into the global tournaments list', async () => {
    const token = await registerAndLogin('global');
    const teamId = await createTeam(token);

    await createGame(token, teamId);

    const tournamentsRes = await request(app)
      .get(`/api/v1/teams/${teamId}/tournaments`)
      .set('Authorization', `Bearer ${token}`);
    const friendly = (tournamentsRes.body as Array<{ id: string; name: string }>).find(
      (t) => t.name === 'Friendly',
    );
    expect(friendly).toBeDefined();

    const globalRes = await request(app)
      .get('/api/v1/tournaments')
      .set('Authorization', `Bearer ${token}`);
    expect(globalRes.status).toBe(200);
    const globalIds = (globalRes.body as Array<{ id: string }>).map((t) => t.id);
    expect(globalIds).not.toContain(friendly!.id);
  });
});
