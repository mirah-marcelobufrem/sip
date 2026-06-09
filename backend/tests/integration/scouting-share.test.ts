import request from 'supertest';
import app from '../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `scouting-share-${suffix}-${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Scouting Share User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createReport(token: string) {
  const res = await request(app)
    .post('/api/v1/scouting-reports')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: `Test Report ${Date.now()}`, visibility: 'private' });
  return res.body as { id: string; shareToken: string | null };
}

describe('GET /api/v1/scouting-reports/share/:token', () => {
  it('returns 404 for an invalid (non-existent) share token', async () => {
    const res = await request(app)
      .get('/api/v1/scouting-reports/share/invalidtokenvalue00000000000000');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('returns the report without auth when a valid share token is used', async () => {
    const token = await registerAndLogin('valid');
    const report = await createReport(token);

    // Generate a share token
    const shareRes = await request(app)
      .post(`/api/v1/scouting-reports/${report.id}/share`)
      .set('Authorization', `Bearer ${token}`)
      .send({ revoke: false });

    expect(shareRes.status).toBe(200);
    const shareToken = shareRes.body.shareToken as string;
    expect(shareToken).toBeDefined();

    // Fetch by share token — no Authorization header
    const getRes = await request(app)
      .get(`/api/v1/scouting-reports/share/${shareToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(report.id);
    expect(getRes.body.visibility).toBe('link');
  });

  it('returns 404 after the share token has been revoked', async () => {
    const token = await registerAndLogin('revoke');
    const report = await createReport(token);

    // Generate a share token
    const shareRes = await request(app)
      .post(`/api/v1/scouting-reports/${report.id}/share`)
      .set('Authorization', `Bearer ${token}`)
      .send({ revoke: false });

    const shareToken = shareRes.body.shareToken as string;

    // Revoke the token
    const revokeRes = await request(app)
      .post(`/api/v1/scouting-reports/${report.id}/share`)
      .set('Authorization', `Bearer ${token}`)
      .send({ revoke: true });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.shareToken).toBeNull();

    // Attempt to fetch with the now-revoked token
    const getRes = await request(app)
      .get(`/api/v1/scouting-reports/share/${shareToken}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.code).toBe('NOT_FOUND');
  });
});
