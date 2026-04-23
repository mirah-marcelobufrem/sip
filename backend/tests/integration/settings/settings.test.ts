import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin() {
  const email = `settings-${Date.now()}@example.com`;
  await request(app).post('/api/v1/auth/register').send({ email, password: 'password123', displayName: 'Settings User' });
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

describe('GET /api/v1/settings', () => {
  it('returns default preferences for a new user', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .get('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('preferences');
    expect(typeof res.body.preferences).toBe('object');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/settings');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/settings', () => {
  it('updates preferences and returns them', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark', showAdvancedStats: true, defaultFoulLimit: 6 });

    expect(res.status).toBe(200);
    expect(res.body.preferences.theme).toBe('dark');
    expect(res.body.preferences.showAdvancedStats).toBe(true);
    expect(res.body.preferences.defaultFoulLimit).toBe(6);
  });

  it('merges with existing preferences', async () => {
    const token = await registerAndLogin();
    await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'light' });

    const res = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'pt' });

    expect(res.body.preferences.theme).toBe('light');
    expect(res.body.preferences.language).toBe('pt');
  });

  it('rejects invalid theme value', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .put('/api/v1/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'neon' });

    expect(res.status).toBe(400);
  });
});
