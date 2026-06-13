import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `boxmetrics-${suffix}${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Box Metrics User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeamAndGame(token: string) {
  const teamRes = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Box Metrics Team ${Date.now()}` });
  const teamId = teamRes.body.id as string;

  const gameRes = await request(app)
    .post(`/api/v1/teams/${teamId}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({ date: new Date().toISOString() });
  return { teamId, gameId: gameRes.body.id as string };
}

async function createPlayer(token: string, teamId: string, firstName: string, jerseyNumber: number) {
  const res = await request(app)
    .post(`/api/v1/teams/${teamId}/players`)
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName, lastName: 'Metrics', jerseyNumber });
  return res.body.id as string;
}

async function postEvent(
  token: string,
  gameId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await request(app)
    .post(`/api/v1/games/${gameId}/events`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  expect(res.status).toBe(201);
}

describe('S07 v5 — stat integrity metrics (N-01/N-03/N-04/N-13)', () => {
  it('box-score rows expose stint minutes, plus/minus, four factors and team metrics', async () => {
    const token = await registerAndLogin('box');
    const { teamId, gameId: defaultGameId } = await createTeamAndGame(token);
    void defaultGameId;

    // A managed away team makes possession bookkeeping work end-to-end
    // (vs unmanaged opponents possession resolves to null — by design)
    const awayRes = await request(app)
      .post('/api/v1/teams')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Box Metrics Away ${Date.now()}` });
    const awayTeamId = awayRes.body.id as string;
    const gameRes = await request(app)
      .post(`/api/v1/teams/${teamId}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: new Date().toISOString(), awayTeamId });
    const gameId = gameRes.body.id as string;

    const starter = await createPlayer(token, teamId, 'Starter', 4);
    const benchy = await createPlayer(token, teamId, 'Benchy', 5);

    // Initial lineup: the starter alone (N-01 stint source, N-04 starters)
    const lineupRes = await request(app)
      .post(`/api/v1/games/${gameId}/lineups/initial`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId, playerIds: [starter] });
    expect(lineupRes.status).toBe(201);

    // Opening possession to the home team (jump-ball outcome), then a paint
    // bucket by the starter (PIP + scoring), then a substitution, then a
    // bench three
    await postEvent(token, gameId, { period: 1, statType: 'PERIOD_START', teamId });
    await postEvent(token, gameId, {
      period: 1, statType: '2PM', playerId: starter, teamId, xCourt: 0.5, yCourt: 0.3,
    });
    const subRes = await request(app)
      .post(`/api/v1/games/${gameId}/lineups`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId, period: 1, playerOutId: starter, playerInId: benchy });
    expect(subRes.status).toBe(201);
    await postEvent(token, gameId, { period: 1, statType: '3PM', playerId: benchy, teamId });

    const boxRes = await request(app)
      .get(`/api/v1/games/${gameId}/box-score`)
      .set('Authorization', `Bearer ${token}`);
    expect(boxRes.status).toBe(200);

    const rows = boxRes.body as Array<Record<string, unknown>>;
    const starterRow = rows.find((r) => r['playerId'] === starter);
    const benchRow = rows.find((r) => r['playerId'] === benchy);
    expect(starterRow).toBeDefined();
    expect(benchRow).toBeDefined();

    // N-01 — minutes are real now (period split between starter and sub)
    expect(starterRow!['minSeconds'] as number).toBeGreaterThan(0);
    expect(benchRow!['minSeconds'] as number).toBeGreaterThan(0);
    // The whole period is distributed across the two stints
    expect(
      (starterRow!['minSeconds'] as number) + (benchRow!['minSeconds'] as number),
    ).toBeCloseTo(600, 5);

    // N-01 — plus/minus reflects points scored while on court
    expect(starterRow!['plusMinus']).toBe(2);
    expect(benchRow!['plusMinus']).toBe(3);

    // N-03 — four factors repeated on the team's rows
    const fourFactors = starterRow!['fourFactors'] as Record<string, number | null>;
    expect(fourFactors).toBeDefined();
    expect(fourFactors['efgPct']).toBeCloseTo((2 + 0.5 * 1) / 2, 10); // (FGM + 0.5·3PM)/FGA = 1.25
    expect(fourFactors['ftRate']).toBe(0);

    // N-04 — team metrics repeated on the team's rows
    const teamMetrics = starterRow!['teamMetrics'] as Record<string, number | null>;
    expect(teamMetrics).toBeDefined();
    expect(teamMetrics['pip']).toBe(2); // the paint 2PM
    expect(teamMetrics['benchPoints']).toBe(3); // Benchy's three
    // Possession was seeded via PERIOD_START → at least one home possession
    expect(teamMetrics['ppp']).not.toBeNull();
    expect(teamMetrics['ppp'] as number).toBeGreaterThan(0);
  });

  it('season-stats honors ?per=40 and keeps legacy ?per36=true working', async () => {
    const token = await registerAndLogin('per40');
    const { teamId, gameId } = await createTeamAndGame(token);
    const player = await createPlayer(token, teamId, 'Norma', 7);

    await request(app)
      .post(`/api/v1/games/${gameId}/lineups/initial`)
      .set('Authorization', `Bearer ${token}`)
      .send({ teamId, playerIds: [player] });
    await postEvent(token, gameId, { period: 1, statType: '2PM', playerId: player, teamId });
    await request(app)
      .post(`/api/v1/games/${gameId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ finalScoreHome: 2, finalScoreAway: 0 });

    const raw = await request(app)
      .get(`/api/v1/teams/${teamId}/players/season-stats`)
      .set('Authorization', `Bearer ${token}`);
    expect(raw.status).toBe(200);
    const rawRow = (raw.body as Array<{ box: { pts: number; minSeconds: number } }>)[0];
    expect(rawRow.box.pts).toBe(2);
    // Sole lineup player with events only in period 1 → 600 s
    expect(rawRow.box.minSeconds).toBeCloseTo(600, 5);

    const per40 = await request(app)
      .get(`/api/v1/teams/${teamId}/players/season-stats?per=40`)
      .set('Authorization', `Bearer ${token}`);
    expect(per40.status).toBe(200);
    const per40Row = (per40.body as Array<{ box: { pts: number } }>)[0];
    // 2 pts in 10 minutes → 8 pts per 40
    expect(per40Row.box.pts).toBeCloseTo(8, 5);

    const legacy = await request(app)
      .get(`/api/v1/teams/${teamId}/players/season-stats?per36=true`)
      .set('Authorization', `Bearer ${token}`);
    expect(legacy.status).toBe(200);
    const legacyRow = (legacy.body as Array<{ box: { pts: number } }>)[0];
    // 2 pts in 10 minutes → 7.2 pts per 36
    expect(legacyRow.box.pts).toBeCloseTo(7.2, 5);
  });

  it('efficiency endpoint returns four factors for both sides', async () => {
    const token = await registerAndLogin('eff');
    const { teamId, gameId } = await createTeamAndGame(token);
    const player = await createPlayer(token, teamId, 'Effie', 9);

    await postEvent(token, gameId, { period: 1, statType: '2PM', playerId: player, teamId });
    await postEvent(token, gameId, { period: 1, statType: 'TO', playerId: player, teamId });
    await request(app)
      .post(`/api/v1/games/${gameId}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .send({ finalScoreHome: 2, finalScoreAway: 0 });

    const res = await request(app)
      .get(`/api/v1/teams/${teamId}/efficiency`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const fourFactors = res.body.fourFactors as Record<string, number | null>;
    expect(fourFactors).toBeDefined();
    expect(fourFactors['efgPct']).toBe(1); // 1 FGM / 1 FGA
    expect(fourFactors['tovPct']).toBeCloseTo(1 / 2, 10); // 1 TO / (1 FGA + 1 TO)
    // No opponent events recorded → opponent factors exist with null/zero members
    expect(res.body.fourFactorsOpp).toBeDefined();
  });
});
