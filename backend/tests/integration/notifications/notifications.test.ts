import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin() {
  const email = `notif-${Date.now()}@example.com`;
  await request(app).post('/api/v1/auth/register').send({ email, password: 'password123', displayName: 'Notif User' });
  const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

describe('GET /api/v1/notifications/vapid-public-key', () => {
  it('returns vapid key field (may be empty when VAPID not configured)', async () => {
    const res = await request(app).get('/api/v1/notifications/vapid-public-key');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('key');
  });
});

describe('POST /api/v1/notifications/subscribe', () => {
  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/subscribe')
      .send({ endpoint: 'https://push.example.com/sub/123', keys: { p256dh: 'abc', auth: 'def' } });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing keys', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post('/api/v1/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('saves subscription for valid payload', async () => {
    const token = await registerAndLogin();
    const res = await request(app)
      .post('/api/v1/notifications/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({
        endpoint: `https://push.example.com/sub/${Date.now()}`,
        keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlqHgx7k3m2zKh0Wmo', auth: 'tBHItJI5svbpez7KI4CCXg' },
      });
    expect(res.status).toBe(201);
  });
});
