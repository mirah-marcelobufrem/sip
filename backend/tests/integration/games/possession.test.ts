import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `possession-${suffix}${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Possession User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeam(token: string, name: string) {
  const teamRes = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `${name} ${Date.now()}` });
  return teamRes.body.id as string;
}

/** Game between two MANAGED teams so possession can flip to a real teams(id). */
async function createTwoTeamGame(token: string) {
  const homeTeamId = await createTeam(token, 'Possession Home');
  const awayTeamId = await createTeam(token, 'Possession Away');

  const gameRes = await request(app)
    .post(`/api/v1/teams/${homeTeamId}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({ date: new Date().toISOString(), awayTeamId });
  return { homeTeamId, awayTeamId, gameId: gameRes.body.id as string };
}

async function postEvent(
  token: string,
  gameId: string,
  statType: string,
  teamId?: string,
) {
  return request(app)
    .post(`/api/v1/games/${gameId}/events`)
    .set('Authorization', `Bearer ${token}`)
    .send({ period: 1, statType, ...(teamId ? { teamId } : {}) });
}

async function getGame(token: string, gameId: string) {
  return request(app)
    .get(`/api/v1/games/${gameId}`)
    .set('Authorization', `Bearer ${token}`);
}

describe('F-01 possession tracking via POST /api/v1/games/:gameId/events', () => {
  it('GET /games/:gameId exposes currentPossessionTeamId and possessionArrowTeamId (initially null)', async () => {
    const token = await registerAndLogin('fields');
    const { gameId } = await createTwoTeamGame(token);

    const res = await getGame(token, gameId);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentPossessionTeamId');
    expect(res.body).toHaveProperty('possessionArrowTeamId');
    expect(res.body.currentPossessionTeamId).toBeNull();
    expect(res.body.possessionArrowTeamId).toBeNull();
  });

  it('2PM by the home team flips possession away from the home team', async () => {
    const token = await registerAndLogin('2pm');
    const { homeTeamId, awayTeamId, gameId } = await createTwoTeamGame(token);

    const eventRes = await postEvent(token, gameId, '2PM', homeTeamId);
    expect(eventRes.status).toBe(201);

    const res = await getGame(token, gameId);
    expect(res.status).toBe(200);
    expect(res.body.currentPossessionTeamId).not.toBe(homeTeamId);
    expect(res.body.currentPossessionTeamId).toBe(awayTeamId);
  });

  it('DREB by the home team gives possession to the home team', async () => {
    const token = await registerAndLogin('dreb');
    const { homeTeamId, gameId } = await createTwoTeamGame(token);

    await postEvent(token, gameId, 'DREB', homeTeamId);

    const res = await getGame(token, gameId);
    expect(res.body.currentPossessionTeamId).toBe(homeTeamId);
  });

  it('OREB by the home team keeps possession unchanged', async () => {
    const token = await registerAndLogin('oreb');
    const { homeTeamId, gameId } = await createTwoTeamGame(token);

    // Establish home possession first
    await postEvent(token, gameId, 'DREB', homeTeamId);
    const before = await getGame(token, gameId);
    expect(before.body.currentPossessionTeamId).toBe(homeTeamId);

    await postEvent(token, gameId, 'OREB', homeTeamId);
    const after = await getGame(token, gameId);
    expect(after.body.currentPossessionTeamId).toBe(homeTeamId);
  });

  it('TO by the home team flips possession to the non-offending (away) team', async () => {
    const token = await registerAndLogin('to');
    const { homeTeamId, awayTeamId, gameId } = await createTwoTeamGame(token);

    await postEvent(token, gameId, 'DREB', homeTeamId);
    await postEvent(token, gameId, 'TO', homeTeamId);

    const res = await getGame(token, gameId);
    expect(res.body.currentPossessionTeamId).toBe(awayTeamId);
  });

  it('STL by the home team gives possession to the stealing (home) team', async () => {
    const token = await registerAndLogin('stl');
    const { homeTeamId, awayTeamId, gameId } = await createTwoTeamGame(token);

    // Away has the ball, then home steals it
    await postEvent(token, gameId, 'DREB', awayTeamId);
    const mid = await getGame(token, gameId);
    expect(mid.body.currentPossessionTeamId).toBe(awayTeamId);

    await postEvent(token, gameId, 'STL', homeTeamId);
    const res = await getGame(token, gameId);
    expect(res.body.currentPossessionTeamId).toBe(homeTeamId);
  });

  it('non-possession events (missed shot, assist) leave possession unchanged', async () => {
    const token = await registerAndLogin('neutral');
    const { homeTeamId, gameId } = await createTwoTeamGame(token);

    await postEvent(token, gameId, 'DREB', homeTeamId);
    await postEvent(token, gameId, '2PA', homeTeamId); // missed shot → await rebound
    await postEvent(token, gameId, 'AST', homeTeamId);

    const res = await getGame(token, gameId);
    expect(res.body.currentPossessionTeamId).toBe(homeTeamId);
  });

  it('possession sequences chain through repeated state transitions (open/close indirectly)', async () => {
    const token = await registerAndLogin('chain');
    const { homeTeamId, awayTeamId, gameId } = await createTwoTeamGame(token);

    // home gains possession → 2PM flips to away → away TO flips back to home
    await postEvent(token, gameId, 'DREB', homeTeamId);
    let res = await getGame(token, gameId);
    expect(res.body.currentPossessionTeamId).toBe(homeTeamId);

    await postEvent(token, gameId, '2PM', homeTeamId);
    res = await getGame(token, gameId);
    expect(res.body.currentPossessionTeamId).toBe(awayTeamId);

    await postEvent(token, gameId, 'TO', awayTeamId);
    res = await getGame(token, gameId);
    expect(res.body.currentPossessionTeamId).toBe(homeTeamId);
  });

  it('unmanaged opponent: 2PM by home never leaves possession with the home team and never loses the event', async () => {
    const token = await registerAndLogin('unmanaged');
    const homeTeamId = await createTeam(token, 'Unmanaged Opp Home');
    const gameRes = await request(app)
      .post(`/api/v1/teams/${homeTeamId}/games`)
      .set('Authorization', `Bearer ${token}`)
      .send({ date: new Date().toISOString() }); // no awayTeamId — unmanaged opponent
    const gameId = gameRes.body.id as string;

    const eventRes = await postEvent(token, gameId, '2PM', homeTeamId);
    expect(eventRes.status).toBe(201); // best-effort possession must not lose the event

    const res = await getGame(token, gameId);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentPossessionTeamId');
    // Cannot assert opponent-side possession for an unmanaged opponent (FK → teams);
    // only that possession is not credited to the home team after its made shot.
    expect(res.body.currentPossessionTeamId).not.toBe(homeTeamId);
  });
});
