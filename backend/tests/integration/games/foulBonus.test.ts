import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `foulbonus-${suffix}${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Foul Bonus User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeamAndGame(token: string) {
  const teamRes = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Foul Bonus Team ${Date.now()}` });
  const teamId = teamRes.body.id as string;

  const gameRes = await request(app)
    .post(`/api/v1/teams/${teamId}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({ date: new Date().toISOString() });
  return { teamId, gameId: gameRes.body.id as string };
}

function recordFoul(
  token: string,
  gameId: string,
  teamId: string,
  opts: { period?: number; isBenchFoul?: boolean; statType?: string } = {},
) {
  return request(app)
    .post(`/api/v1/games/${gameId}/events`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      period: opts.period ?? 1,
      statType: opts.statType ?? 'PF',
      teamId,
      ...(opts.isBenchFoul !== undefined ? { isBenchFoul: opts.isBenchFoul } : {}),
    });
}

function getGame(token: string, gameId: string) {
  return request(app)
    .get(`/api/v1/games/${gameId}`)
    .set('Authorization', `Bearer ${token}`);
}

describe('GET /api/v1/games/:gameId — team foul / bonus state (S06 I-06)', () => {
  it('reports 4 fouls without bonus, then enters bonus on the 5th foul', async () => {
    const token = await registerAndLogin('threshold');
    const { teamId, gameId } = await createTeamAndGame(token);

    for (let i = 0; i < 4; i++) {
      const res = await recordFoul(token, gameId, teamId);
      expect(res.status).toBe(201);
    }

    const before = await getGame(token, gameId);
    expect(before.status).toBe(200);
    expect(before.body.homeTeamFoulsThisPeriod).toBe(4);
    expect(before.body.homeInBonus).toBe(false);
    expect(before.body.awayTeamFoulsThisPeriod).toBe(0);
    expect(before.body.awayInBonus).toBe(false);

    const fifth = await recordFoul(token, gameId, teamId);
    expect(fifth.status).toBe(201);

    const after = await getGame(token, gameId);
    expect(after.status).toBe(200);
    expect(after.body.homeTeamFoulsThisPeriod).toBe(5);
    expect(after.body.homeInBonus).toBe(true);
    // The away side never fouled — must stay out of the bonus
    expect(after.body.awayInBonus).toBe(false);
  });

  it('does not count bench fouls (isBenchFoul=true) toward the team foul total', async () => {
    const token = await registerAndLogin('bench');
    const { teamId, gameId } = await createTeamAndGame(token);

    const normal = await recordFoul(token, gameId, teamId);
    expect(normal.status).toBe(201);

    const bench = await recordFoul(token, gameId, teamId, { isBenchFoul: true });
    expect(bench.status).toBe(201);
    expect(bench.body.isBenchFoul).toBe(true);

    const res = await getGame(token, gameId);
    expect(res.status).toBe(200);
    // Only the normal PF counts; the bench foul is excluded (BR-STAT-9.3)
    expect(res.body.homeTeamFoulsThisPeriod).toBe(1);
    expect(res.body.homeInBonus).toBe(false);
  });

  it('resets the visible foul count when the game advances to a new period', async () => {
    const token = await registerAndLogin('period');
    const { teamId, gameId } = await createTeamAndGame(token);

    // 5 fouls in period 1 → in bonus for period 1
    for (let i = 0; i < 5; i++) {
      const res = await recordFoul(token, gameId, teamId, { period: 1 });
      expect(res.status).toBe(201);
    }
    const p1 = await getGame(token, gameId);
    expect(p1.body.homeTeamFoulsThisPeriod).toBe(5);
    expect(p1.body.homeInBonus).toBe(true);

    // Advance to period 2 (same PATCH body the live page sends)
    const patch = await request(app)
      .patch(`/api/v1/games/${gameId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPeriod: 2 });
    expect(patch.status).toBe(200);
    expect(patch.body.currentPeriod).toBe(2);

    // Period-1 fouls do not carry into period 2
    const p2 = await getGame(token, gameId);
    expect(p2.body.homeTeamFoulsThisPeriod).toBe(0);
    expect(p2.body.homeInBonus).toBe(false);

    // A fresh foul in period 2 counts from zero
    const foul = await recordFoul(token, gameId, teamId, { period: 2 });
    expect(foul.status).toBe(201);
    const p2After = await getGame(token, gameId);
    expect(p2After.body.homeTeamFoulsThisPeriod).toBe(1);
    expect(p2After.body.homeInBonus).toBe(false);
  });

  it('counts technical and flagrant fouls toward the bonus alongside personal fouls', async () => {
    const token = await registerAndLogin('mixed');
    const { teamId, gameId } = await createTeamAndGame(token);

    // 3 PF + 1 TF + 1 FF = 5 team fouls → bonus
    for (let i = 0; i < 3; i++) {
      await recordFoul(token, gameId, teamId);
    }
    await recordFoul(token, gameId, teamId, { statType: 'TF' });
    await recordFoul(token, gameId, teamId, { statType: 'FF' });

    const res = await getGame(token, gameId);
    expect(res.status).toBe(200);
    expect(res.body.homeTeamFoulsThisPeriod).toBe(5);
    expect(res.body.homeInBonus).toBe(true);
  });
});
