import request from 'supertest';
import app from '../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `dev-${suffix}-${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Dev Test User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeamAndPlayer(token: string) {
  const teamRes = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Dev Team ${Date.now()}` });
  const teamId = teamRes.body.id as string;

  const playerRes = await request(app)
    .post(`/api/v1/teams/${teamId}/players`)
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName: 'John', lastName: 'Dev' });
  const playerId = playerRes.body.id as string;

  return { teamId, playerId };
}

describe('Development entries', () => {
  describe('GET /api/v1/players/:playerId/development', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/v1/players/00000000-0000-0000-0000-000000000001/development');
      expect(res.status).toBe(401);
    });

    it('returns empty array when no entries exist', async () => {
      const token = await registerAndLogin('get-empty');
      const { playerId } = await createTeamAndPlayer(token);

      const res = await request(app)
        .get(`/api/v1/players/${playerId}/development`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /api/v1/players/:playerId/development', () => {
    it('creates a development entry and returns 201', async () => {
      const token = await registerAndLogin('post-entry');
      const { playerId } = await createTeamAndPlayer(token);

      const res = await request(app)
        .post(`/api/v1/players/${playerId}/development`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: new Date().toISOString(),
          category: 'technical',
          metricName: 'Free throw %',
          metricValue: 0.75,
          notes: 'Good session',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.playerId).toBe(playerId);
      expect(res.body.metricName).toBe('Free throw %');
      expect(res.body.category).toBe('technical');
    });

    it('returns 400 for missing required fields', async () => {
      const token = await registerAndLogin('post-entry-bad');
      const { playerId } = await createTeamAndPlayer(token);

      const res = await request(app)
        .post(`/api/v1/players/${playerId}/development`)
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'technical' }); // missing date and metricName

      expect(res.status).toBe(400);
    });

    it('returns entries after creating one', async () => {
      const token = await registerAndLogin('get-after-post');
      const { playerId } = await createTeamAndPlayer(token);

      await request(app)
        .post(`/api/v1/players/${playerId}/development`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: new Date().toISOString(),
          category: 'physical',
          metricName: 'Sprint time',
          metricValue: 4.2,
        });

      const listRes = await request(app)
        .get(`/api/v1/players/${playerId}/development`)
        .set('Authorization', `Bearer ${token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBeGreaterThanOrEqual(1);
      expect(listRes.body[0].metricName).toBe('Sprint time');
    });
  });

  describe('DELETE /api/v1/players/:playerId/development/:entryId', () => {
    it('returns 204 on successful delete', async () => {
      const token = await registerAndLogin('delete-entry');
      const { playerId } = await createTeamAndPlayer(token);

      const createRes = await request(app)
        .post(`/api/v1/players/${playerId}/development`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: new Date().toISOString(),
          category: 'mental',
          metricName: 'Focus score',
          metricValue: 8,
        });

      const entryId = createRes.body.id as string;

      const deleteRes = await request(app)
        .delete(`/api/v1/players/${playerId}/development/${entryId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(204);
    });

    it('returns 404 when entry does not exist', async () => {
      const token = await registerAndLogin('delete-missing');
      const { playerId } = await createTeamAndPlayer(token);

      const res = await request(app)
        .delete(`/api/v1/players/${playerId}/development/00000000-0000-0000-0000-000000000099`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});

describe('Development goals', () => {
  describe('GET /api/v1/players/:playerId/development/goals', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/v1/players/00000000-0000-0000-0000-000000000001/development/goals');
      expect(res.status).toBe(401);
    });

    it('returns empty array when no goals exist', async () => {
      const token = await registerAndLogin('goals-empty');
      const { playerId } = await createTeamAndPlayer(token);

      const res = await request(app)
        .get(`/api/v1/players/${playerId}/development/goals`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /api/v1/players/:playerId/development/goals', () => {
    it('creates a goal and returns 201', async () => {
      const token = await registerAndLogin('post-goal');
      const { playerId } = await createTeamAndPlayer(token);

      const res = await request(app)
        .post(`/api/v1/players/${playerId}/development/goals`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          metricName: 'Three-point %',
          targetValue: 0.4,
          targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.playerId).toBe(playerId);
      expect(res.body.metricName).toBe('Three-point %');
      expect(res.body.targetValue).toBeCloseTo(0.4);
    });

    it('returns 400 for missing required fields', async () => {
      const token = await registerAndLogin('post-goal-bad');
      const { playerId } = await createTeamAndPlayer(token);

      const res = await request(app)
        .post(`/api/v1/players/${playerId}/development/goals`)
        .set('Authorization', `Bearer ${token}`)
        .send({ metricName: 'Three-point %' }); // missing targetValue

      expect(res.status).toBe(400);
    });
  });
});
