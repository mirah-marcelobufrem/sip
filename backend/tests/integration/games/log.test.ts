import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `log-${suffix}${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Log User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeamAndGame(token: string) {
  const teamRes = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Log Team ${Date.now()}` });
  const teamId = teamRes.body.id as string;

  const gameRes = await request(app)
    .post(`/api/v1/teams/${teamId}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({ date: new Date().toISOString() });
  return { teamId, gameId: gameRes.body.id as string };
}

describe('GET /api/v1/games/:gameId/log', () => {
  it('returns events ordered by period then createdAt', async () => {
    const token = await registerAndLogin('order');
    const { gameId } = await createTeamAndGame(token);

    // Create events in period 2 and period 1 to verify ordering
    const p2Res = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 2, statType: '2PM' });

    const p1Res = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '3PM' });

    expect(p2Res.status).toBe(201);
    expect(p1Res.status).toBe(201);

    const logRes = await request(app)
      .get(`/api/v1/games/${gameId}/log`)
      .set('Authorization', `Bearer ${token}`);

    expect(logRes.status).toBe(200);
    const events = logRes.body as Array<{ id: string; period: number }>;
    expect(events.length).toBe(2);

    // Period 1 event should come first
    expect(events[0].id).toBe(p1Res.body.id);
    expect(events[0].period).toBe(1);
    expect(events[1].id).toBe(p2Res.body.id);
    expect(events[1].period).toBe(2);
  });

  it('excludes soft-deleted events from the log', async () => {
    const token = await registerAndLogin('deleted');
    const { gameId } = await createTeamAndGame(token);

    const e1Res = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM' });

    const e2Res = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: 'AST' });

    expect(e1Res.status).toBe(201);
    expect(e2Res.status).toBe(201);

    // Soft-delete e1
    await request(app)
      .delete(`/api/v1/games/${gameId}/events/${e1Res.body.id}`)
      .set('Authorization', `Bearer ${token}`);

    const logRes = await request(app)
      .get(`/api/v1/games/${gameId}/log`)
      .set('Authorization', `Bearer ${token}`);

    expect(logRes.status).toBe(200);
    const ids = (logRes.body as Array<{ id: string }>).map((e) => e.id);
    expect(ids).not.toContain(e1Res.body.id);
    expect(ids).toContain(e2Res.body.id);
  });

  it('returns an empty array for a game with no events', async () => {
    const token = await registerAndLogin('empty');
    const { gameId } = await createTeamAndGame(token);

    const logRes = await request(app)
      .get(`/api/v1/games/${gameId}/log`)
      .set('Authorization', `Bearer ${token}`);

    expect(logRes.status).toBe(200);
    expect(Array.isArray(logRes.body)).toBe(true);
    expect(logRes.body).toHaveLength(0);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .get('/api/v1/games/00000000-0000-0000-0000-000000000001/log');
    expect(res.status).toBe(401);
  });
});
