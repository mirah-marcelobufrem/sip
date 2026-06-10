import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `linked-${suffix}${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Linked User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeamAndGame(token: string) {
  const teamRes = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Linked Team ${Date.now()}` });
  const teamId = teamRes.body.id as string;

  const gameRes = await request(app)
    .post(`/api/v1/teams/${teamId}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({ date: new Date().toISOString() });
  return { teamId, gameId: gameRes.body.id as string };
}

interface LogEvent {
  id: string;
  linkedActionId: string | null;
  linkRole: string | null;
  linkedChildren: string[];
}

async function getLog(token: string, gameId: string): Promise<LogEvent[]> {
  const res = await request(app)
    .get(`/api/v1/games/${gameId}/log`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body as LogEvent[];
}

describe('F-08 linked actions', () => {
  it('creates a child event linked to its parent and exposes the link in /log', async () => {
    const token = await registerAndLogin('log');
    const { gameId } = await createTeamAndGame(token);

    const parentRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PA' });
    expect(parentRes.status).toBe(201);
    const parentId = parentRes.body.id as string;

    const childRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        period: 1,
        statType: 'OREB',
        linkedActionId: parentId,
        linkRole: 'rebound_after_miss',
      });
    expect(childRes.status).toBe(201);
    expect(childRes.body.linkedActionId).toBe(parentId);
    expect(childRes.body.linkRole).toBe('rebound_after_miss');
    const childId = childRes.body.id as string;

    const log = await getLog(token, gameId);
    const parent = log.find((e) => e.id === parentId);
    const child = log.find((e) => e.id === childId);

    expect(parent).toBeDefined();
    expect(parent!.linkedChildren).toContain(childId);
    expect(child).toBeDefined();
    expect(child!.linkedActionId).toBe(parentId);
    expect(child!.linkRole).toBe('rebound_after_miss');
  });

  it('deleting the parent cascades to linked children and returns all deleted ids', async () => {
    const token = await registerAndLogin('cascade');
    const { gameId } = await createTeamAndGame(token);

    const parentRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PA' });
    const parentId = parentRes.body.id as string;

    const childRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        period: 1,
        statType: 'OREB',
        linkedActionId: parentId,
        linkRole: 'rebound_after_miss',
      });
    const childId = childRes.body.id as string;

    const deleteRes = await request(app)
      .delete(`/api/v1/games/${gameId}/events/${parentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deletedIds).toHaveLength(2);
    expect(deleteRes.body.deletedIds).toEqual(
      expect.arrayContaining([parentId, childId]),
    );
    // Children are soft-deleted before the parent
    expect(deleteRes.body.deletedIds[deleteRes.body.deletedIds.length - 1]).toBe(parentId);

    const log = await getLog(token, gameId);
    const ids = log.map((e) => e.id);
    expect(ids).not.toContain(parentId);
    expect(ids).not.toContain(childId);
  });

  it('deleting a leaf event with no children returns only its own id', async () => {
    const token = await registerAndLogin('leaf');
    const { gameId } = await createTeamAndGame(token);

    const leafRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: 'AST' });
    const leafId = leafRes.body.id as string;

    const deleteRes = await request(app)
      .delete(`/api/v1/games/${gameId}/events/${leafId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deletedIds).toEqual([leafId]);
  });

  it('rejects an invalid linkRole with 400', async () => {
    const token = await registerAndLogin('badrole');
    const { gameId } = await createTeamAndGame(token);

    const parentRes = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PA' });

    const res = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        period: 1,
        statType: 'OREB',
        linkedActionId: parentRes.body.id,
        linkRole: 'not_a_real_role',
      });
    expect(res.status).toBe(400);
  });
});
