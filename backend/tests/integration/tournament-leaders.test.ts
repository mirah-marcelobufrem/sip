import request from 'supertest';
import app from '../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `tournament-leaders-${suffix}-${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Tournament Leaders User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTournament(token: string) {
  const res = await request(app)
    .post('/api/v1/tournaments')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Test Tournament ${Date.now()}`,
      format: 'single_elimination',
      numTeams: 4,
      teams: [
        { seed: 1, teamName: 'Team Alpha' },
        { seed: 2, teamName: 'Team Beta' },
        { seed: 3, teamName: 'Team Gamma' },
        { seed: 4, teamName: 'Team Delta' },
      ],
    });
  return res.body as { id: string };
}

describe('GET /api/v1/tournaments/:id/leaders', () => {
  it('returns 200 with the four leader categories as arrays', async () => {
    const token = await registerAndLogin('structure');
    const tournament = await createTournament(token);

    const res = await request(app)
      .get(`/api/v1/tournaments/${tournament.id}/leaders`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.points)).toBe(true);
    expect(Array.isArray(res.body.rebounds)).toBe(true);
    expect(Array.isArray(res.body.assists)).toBe(true);
    expect(Array.isArray(res.body.steals)).toBe(true);
  });

  it('returns empty arrays when no games are linked to the tournament', async () => {
    const token = await registerAndLogin('empty');
    const tournament = await createTournament(token);

    const res = await request(app)
      .get(`/api/v1/tournaments/${tournament.id}/leaders`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.points).toHaveLength(0);
    expect(res.body.rebounds).toHaveLength(0);
    expect(res.body.assists).toHaveLength(0);
    expect(res.body.steals).toHaveLength(0);
  });

  it('returns 401 without an auth token', async () => {
    const token = await registerAndLogin('auth');
    const tournament = await createTournament(token);

    const res = await request(app)
      .get(`/api/v1/tournaments/${tournament.id}/leaders`);

    expect(res.status).toBe(401);
  });
});
