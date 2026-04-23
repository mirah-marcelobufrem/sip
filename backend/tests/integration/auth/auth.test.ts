import request from 'supertest';
import app from '../../../src/index.js';

describe('POST /api/v1/auth/register', () => {
  it('creates a new user', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `test-${Date.now()}@example.com`,
        password: 'password123',
        displayName: 'Integration Test User',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: expect.stringContaining('@'),
      displayName: 'Integration Test User',
    });
    expect(res.body.id).toBeDefined();
  });

  it('returns 409 for duplicate email', async () => {
    const email = `dup-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'User' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'User' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email', password: 'password123', displayName: 'User' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const email = `login-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'correcthorse', displayName: 'Login User' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'correcthorse' });

    expect(res.status).toBe(200);
    expect(res.body.tokens.accessToken).toBeDefined();
    expect(res.body.tokens.refreshToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('returns 401 for wrong password', async () => {
    const email = `wrong-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'correcthorse', displayName: 'User' });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns current user when authenticated', async () => {
    const email = `me-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'Me User' });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.tokens.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(email);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
