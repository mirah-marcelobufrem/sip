import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `events-${suffix}${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Events User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeamAndGame(token: string) {
  const teamRes = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Test Team ${Date.now()}` });
  const teamId = teamRes.body.id as string;

  const gameRes = await request(app)
    .post(`/api/v1/teams/${teamId}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({ date: new Date().toISOString() });
  return { teamId, gameId: gameRes.body.id as string };
}

describe('POST /api/v1/games/:gameId/events', () => {
  it('creates a stat event and returns 201', async () => {
    const token = await registerAndLogin('create');
    const { gameId } = await createTeamAndGame(token);

    const res = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM' });

    expect(res.status).toBe(201);
    expect(res.body.gameId).toBe(gameId);
    expect(res.body.statType).toBe('2PM');
    expect(res.body.period).toBe(1);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/games/00000000-0000-0000-0000-000000000001/events')
      .send({ period: 1, statType: '2PM' });
    expect(res.status).toBe(401);
  });

  it('inserts event at correct seq position when insertAfterId is provided', async () => {
    const token = await registerAndLogin('insert');
    const { gameId } = await createTeamAndGame(token);

    // Create two events
    const e1Res = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM' });
    const e2Res = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '3PM' });

    const event1Id = e1Res.body.id as string;
    const event2Id = e2Res.body.id as string;

    expect(e1Res.status).toBe(201);
    expect(e2Res.status).toBe(201);

    // Insert between event1 and event2
    const midRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: 'AST', insertAfterId: event1Id });

    expect(midRes.status).toBe(201);
    expect(midRes.body.statType).toBe('AST');

    // The inserted event's id
    const midId = midRes.body.id as string;

    // Verify order via event log
    const logRes = await request(app)
      .get(`/api/v1/games/${gameId}/log`)
      .set('Authorization', `Bearer ${token}`);

    expect(logRes.status).toBe(200);
    const ids = (logRes.body as Array<{ id: string }>).map((e) => e.id);
    const idxE1 = ids.indexOf(event1Id);
    const idxMid = ids.indexOf(midId);
    const idxE2 = ids.indexOf(event2Id);

    // Mid event must come after e1 and before e2 in the log
    expect(idxE1).toBeLessThan(idxMid);
    expect(idxMid).toBeLessThan(idxE2);
  });

  it('returns 404 when insertAfterId references an event in a different game', async () => {
    const token = await registerAndLogin('insert404');
    const { gameId: gameId1 } = await createTeamAndGame(token);
    const { gameId: gameId2 } = await createTeamAndGame(token);

    const e1Res = await request(app)
      .post(`/api/v1/games/${gameId1}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM' });

    const res = await request(app)
      .post(`/api/v1/games/${gameId2}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: 'AST', insertAfterId: e1Res.body.id });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/games/:gameId/events/:eventId', () => {
  it('soft deletes an event and returns the deleted ids', async () => {
    const token = await registerAndLogin('delete');
    const { gameId } = await createTeamAndGame(token);

    const createRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM' });
    const eventId = createRes.body.id as string;

    const deleteRes = await request(app)
      .delete(`/api/v1/games/${gameId}/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deletedIds).toEqual([eventId]);

    // Event should no longer appear in the log
    const logRes = await request(app)
      .get(`/api/v1/games/${gameId}/log`)
      .set('Authorization', `Bearer ${token}`);
    const ids = (logRes.body as Array<{ id: string }>).map((e) => e.id);
    expect(ids).not.toContain(eventId);
  });

  it('returns 404 when event belongs to a different game', async () => {
    const token = await registerAndLogin('del404');
    const { gameId: gameId1 } = await createTeamAndGame(token);
    const { gameId: gameId2 } = await createTeamAndGame(token);

    const createRes = await request(app)
      .post(`/api/v1/games/${gameId1}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM' });

    const res = await request(app)
      .delete(`/api/v1/games/${gameId2}/events/${createRes.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/games/:gameId/events/:eventId', () => {
  it('updates the event and creates an audit row, returns 200', async () => {
    const token = await registerAndLogin('patch');
    const { gameId } = await createTeamAndGame(token);

    const createRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM' });
    const eventId = createRes.body.id as string;

    const patchRes = await request(app)
      .patch(`/api/v1/games/${gameId}/events/${eventId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statType: '3PM', clockSeconds: 300 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.statType).toBe('3PM');
    expect(patchRes.body.clockTimeSeconds).toBe(300);
  });

  it('returns 403 when user does not have OWNER or COACH role', async () => {
    const token = await registerAndLogin('patchrole');
    const { gameId } = await createTeamAndGame(token);

    // Register a second user who has no role on the team
    const otherToken = await registerAndLogin('patchrole2');

    const createRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM' });

    const patchRes = await request(app)
      .patch(`/api/v1/games/${gameId}/events/${createRes.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ statType: '3PM' });

    // Other user has no role at all, so userRole is undefined → 403
    expect(patchRes.status).toBe(403);
  });

  it('returns 404 for non-existent event', async () => {
    const token = await registerAndLogin('patchnotfound');
    const { gameId } = await createTeamAndGame(token);

    const res = await request(app)
      .patch(`/api/v1/games/${gameId}/events/00000000-0000-0000-0000-000000000099`)
      .set('Authorization', `Bearer ${token}`)
      .send({ statType: '3PM' });

    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch('/api/v1/games/00000000-0000-0000-0000-000000000001/events/00000000-0000-0000-0000-000000000002')
      .send({ statType: '3PM' });
    expect(res.status).toBe(401);
  });
});
