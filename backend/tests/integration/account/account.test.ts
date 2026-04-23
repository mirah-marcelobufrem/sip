import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `account-${suffix}${Date.now()}@example.com`;
  await request(app).post('/api/v1/auth/register').send({ email, password: 'password123', displayName: 'Account User' });
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'password123' });
  return { token: res.body.tokens.accessToken as string, email };
}

describe('GET /api/v1/account/export', () => {
  it('returns JSON export for authenticated user', async () => {
    const { token } = await registerAndLogin('export-');
    const res = await request(app)
      .get('/api/v1/account/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('exportedAt');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body).toHaveProperty('teamMemberships');
    expect(res.body).toHaveProperty('scoutingReports');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/account/export');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/account', () => {
  it('soft-deletes the account and returns 204', async () => {
    const { token, email } = await registerAndLogin('delete-');
    const res = await request(app)
      .delete('/api/v1/account')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });
    expect(loginRes.status).toBe(401);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/v1/account');
    expect(res.status).toBe(401);
  });
});
