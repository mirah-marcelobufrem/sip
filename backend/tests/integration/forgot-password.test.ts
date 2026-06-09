import request from 'supertest';
import app from '../../src/index.js';

describe('POST /api/v1/auth/forgot-password', () => {
  it('returns 200 and a generic message for a registered email (never reveals existence)', async () => {
    // Register a user first so the email exists
    const email = `forgot-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'password123', displayName: 'Forgot User' });

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link has been sent/i);
  });

  it('returns 200 and the same generic message for a non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: `nonexistent-${Date.now()}@example.com` });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reset link has been sent/i);
  });

  it('returns 400 when email field is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  it('returns 401 for an invalid reset token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'totally-invalid-token', newPassword: 'newpassword123' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });

  it('returns 400 when token is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ newPassword: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when newPassword is too short', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'sometoken', newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('resets password successfully with a valid token', async () => {
    // 1. Register and obtain a user
    const email = `reset-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'oldpassword123', displayName: 'Reset User' });

    // 2. Request a password reset (token is stored in DB; in tests it is console.log'd)
    //    We obtain the token by directly querying the DB after the request
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email });

    // 3. Retrieve the raw token from the DB via the app's own DB connection
    const { getDb } = await import('../../src/infrastructure/database/connection.js');
    const { users } = await import('../../src/infrastructure/database/schema/users.schema.js');
    const { eq } = await import('drizzle-orm');
    const { createHash, randomBytes } = await import('crypto');

    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const storedHash = rows[0]?.resetToken;
    expect(storedHash).toBeDefined();

    // The route stores SHA-256(rawToken). We cannot reverse that.
    // Instead, repeat the forgot-password flow but generate the token ourselves
    // by patching the DB directly with a known raw token.
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await db.update(users)
      .set({
        resetToken: tokenHash,
        resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
      .where(eq(users.email, email));

    // 4. Use the known raw token to reset the password
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: 'brandnewpassword99' });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toMatch(/reset successfully/i);

    // 5. Confirm login with new password works
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'brandnewpassword99' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.tokens.accessToken).toBeDefined();

    // 6. Confirm old password no longer works
    const oldLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'oldpassword123' });

    expect(oldLoginRes.status).toBe(401);
  });
});
