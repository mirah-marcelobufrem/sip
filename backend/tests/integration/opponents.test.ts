import request from 'supertest';
import app from '../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `opponents-${suffix}-${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Opponents Test User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

describe('Opponent teams', () => {
  describe('GET /api/v1/opponent-teams', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/v1/opponent-teams');
      expect(res.status).toBe(401);
    });

    it('returns array of opponent teams when authenticated', async () => {
      const token = await registerAndLogin('get-list');

      const res = await request(app)
        .get('/api/v1/opponent-teams')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/v1/opponent-teams', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/v1/opponent-teams')
        .send({ name: 'Rival Blazers' });
      expect(res.status).toBe(401);
    });

    it('creates an opponent team and returns 201', async () => {
      const token = await registerAndLogin('post-team');

      const res = await request(app)
        .post('/api/v1/opponent-teams')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Rival Blazers ${Date.now()}`,
          homeCourt: 'Downtown Arena',
          contactName: 'Coach Smith',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toContain('Rival Blazers');
      expect(res.body.homeCourt).toBe('Downtown Arena');
    });

    it('returns 400 for missing required name', async () => {
      const token = await registerAndLogin('post-team-bad');

      const res = await request(app)
        .post('/api/v1/opponent-teams')
        .set('Authorization', `Bearer ${token}`)
        .send({ homeCourt: 'Arena' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/opponent-teams/:id', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get('/api/v1/opponent-teams/00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(401);
    });

    it('returns 200 with team detail for valid id', async () => {
      const token = await registerAndLogin('get-by-id');

      const createRes = await request(app)
        .post('/api/v1/opponent-teams')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Detail Team ${Date.now()}` });

      const teamId = createRes.body.id as string;

      const res = await request(app)
        .get(`/api/v1/opponent-teams/${teamId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(teamId);
      expect(Array.isArray(res.body.players)).toBe(true);
    });

    it('returns 404 for non-existent team', async () => {
      const token = await registerAndLogin('get-missing');

      const res = await request(app)
        .get('/api/v1/opponent-teams/00000000-0000-0000-0000-000000000099')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/opponent-teams/:id', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .delete('/api/v1/opponent-teams/00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(401);
    });

    it('returns 204 on successful soft-delete', async () => {
      const token = await registerAndLogin('delete-team');

      const createRes = await request(app)
        .post('/api/v1/opponent-teams')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Delete Target ${Date.now()}` });

      const teamId = createRes.body.id as string;

      const deleteRes = await request(app)
        .delete(`/api/v1/opponent-teams/${teamId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(204);
    });

    it('returns 404 after deleting a team', async () => {
      const token = await registerAndLogin('delete-then-get');

      const createRes = await request(app)
        .post('/api/v1/opponent-teams')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Ephemeral Team ${Date.now()}` });

      const teamId = createRes.body.id as string;

      await request(app)
        .delete(`/api/v1/opponent-teams/${teamId}`)
        .set('Authorization', `Bearer ${token}`);

      const getRes = await request(app)
        .get(`/api/v1/opponent-teams/${teamId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(404);
    });
  });
});

describe('Opponent teams — ownership isolation', () => {
  it('does not include another user\'s opponent team in the list', async () => {
    const tokenA = await registerAndLogin('owner-a');
    const tokenB = await registerAndLogin('owner-b');

    const teamName = `Owner Isolation Team ${Date.now()}`;
    await request(app)
      .post('/api/v1/opponent-teams')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: teamName });

    const res = await request(app)
      .get('/api/v1/opponent-teams')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.some((t: { name: string }) => t.name === teamName)).toBe(false);
  });

  it('returns 404 when another user requests, updates, or deletes a team by id', async () => {
    const tokenA = await registerAndLogin('cross-a');
    const tokenB = await registerAndLogin('cross-b');

    const createRes = await request(app)
      .post('/api/v1/opponent-teams')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Private Team ${Date.now()}` });
    const teamId = createRes.body.id as string;

    const getRes = await request(app)
      .get(`/api/v1/opponent-teams/${teamId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getRes.status).toBe(404);

    const putRes = await request(app)
      .put(`/api/v1/opponent-teams/${teamId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked Name' });
    expect(putRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/opponent-teams/${teamId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);

    // The owner can still see and manage their own team — it was never touched
    const ownerGetRes = await request(app)
      .get(`/api/v1/opponent-teams/${teamId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(ownerGetRes.status).toBe(200);
    expect(ownerGetRes.body.name).toBe(createRes.body.name);
  });

  it('returns 404 when another user lists, adds, updates, deletes players, or reads stats for a team they do not own', async () => {
    const tokenA = await registerAndLogin('roster-a');
    const tokenB = await registerAndLogin('roster-b');

    const createRes = await request(app)
      .post('/api/v1/opponent-teams')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `Roster Team ${Date.now()}` });
    const teamId = createRes.body.id as string;

    const playerRes = await request(app)
      .post(`/api/v1/opponent-teams/${teamId}/players`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ firstName: 'Owner', lastName: 'Player', jerseyNumber: 23 });
    const playerId = playerRes.body.id as string;

    const listRes = await request(app)
      .get(`/api/v1/opponent-teams/${teamId}/players`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listRes.status).toBe(404);

    const addRes = await request(app)
      .post(`/api/v1/opponent-teams/${teamId}/players`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ firstName: 'Intruder', lastName: 'Player' });
    expect(addRes.status).toBe(404);

    const updateRes = await request(app)
      .put(`/api/v1/opponent-teams/${teamId}/players/${playerId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ jerseyNumber: 99 });
    expect(updateRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/v1/opponent-teams/${teamId}/players/${playerId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);

    const statsRes = await request(app)
      .get(`/api/v1/opponent-teams/${teamId}/stats`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(statsRes.status).toBe(404);
  });
});
