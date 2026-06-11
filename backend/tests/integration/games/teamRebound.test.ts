import request from 'supertest';
import app from '../../../src/index.js';

async function registerAndLogin(suffix = '') {
  const email = `teamreb-${suffix}${Date.now()}@example.com`;
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'password123', displayName: 'Team Rebound User' });
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: 'password123' });
  return res.body.tokens.accessToken as string;
}

async function createTeamAndGame(token: string) {
  const teamRes = await request(app)
    .post('/api/v1/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Team Reb Team ${Date.now()}` });
  const teamId = teamRes.body.id as string;

  const gameRes = await request(app)
    .post(`/api/v1/teams/${teamId}/games`)
    .set('Authorization', `Bearer ${token}`)
    .send({ date: new Date().toISOString() });
  return { teamId, gameId: gameRes.body.id as string };
}

async function createPlayer(token: string, teamId: string) {
  const res = await request(app)
    .post(`/api/v1/teams/${teamId}/players`)
    .set('Authorization', `Bearer ${token}`)
    .send({ firstName: 'Reba', lastName: 'Boarder', jerseyNumber: 15 });
  return res.body.id as string;
}

describe('POST /api/v1/games/:gameId/events — team rebounds (S06 I-05)', () => {
  it('accepts a team rebound without playerId and credits it to teamOReb, not a player', async () => {
    const token = await registerAndLogin('credit');
    const { teamId, gameId } = await createTeamAndGame(token);
    const playerId = await createPlayer(token, teamId);

    // A normal player event so the team has a box-score row
    const shot = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: '2PM', playerId, teamId });
    expect(shot.status).toBe(201);

    // Team offensive rebound — no playerId
    const teamReb = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: 'OREB', teamId, isTeamRebound: true });
    expect(teamReb.status).toBe(201);
    expect(teamReb.body.isTeamRebound).toBe(true);
    expect(teamReb.body.playerId).toBeNull();

    const boxRes = await request(app)
      .get(`/api/v1/games/${gameId}/box-score`)
      .set('Authorization', `Bearer ${token}`);
    expect(boxRes.status).toBe(200);

    const rows = boxRes.body as Array<{
      playerId: string; oreb: number; dreb: number; reb: number;
      teamOReb: number; teamDReb: number;
    }>;
    expect(rows.length).toBeGreaterThan(0);

    // No individual player carries the rebound (BR-STAT-4.3)
    for (const row of rows) {
      expect(row.oreb).toBe(0);
      expect(row.dreb).toBe(0);
    }

    // The team aggregate carries it, repeated on the team's rows
    const playerRow = rows.find((r) => r.playerId === playerId);
    expect(playerRow).toBeDefined();
    expect(playerRow!.teamOReb).toBe(1);
    expect(playerRow!.teamDReb).toBe(0);
  });

  it('rejects a team rebound that carries a playerId with 400', async () => {
    const token = await registerAndLogin('reject');
    const { teamId, gameId } = await createTeamAndGame(token);
    const playerId = await createPlayer(token, teamId);

    const res = await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: 'OREB', teamId, playerId, isTeamRebound: true });

    expect(res.status).toBe(400);

    // The invalid event must not have been persisted
    const logRes = await request(app)
      .get(`/api/v1/games/${gameId}/log`)
      .set('Authorization', `Bearer ${token}`);
    expect(logRes.body).toHaveLength(0);
  });

  it('includes minutesDisplay, teamOReb/teamDReb and teamFoulsByPeriod on box-score rows', async () => {
    const token = await registerAndLogin('fields');
    const { teamId, gameId } = await createTeamAndGame(token);
    const playerId = await createPlayer(token, teamId);

    await request(app)
      .post(`/api/v1/games/${gameId}/events`)
      .set('Authorization', `Bearer ${token}`)
      .send({ period: 1, statType: 'PF', playerId, teamId });

    const boxRes = await request(app)
      .get(`/api/v1/games/${gameId}/box-score`)
      .set('Authorization', `Bearer ${token}`);
    expect(boxRes.status).toBe(200);

    const row = (boxRes.body as Array<Record<string, unknown>>).find(
      (r) => r['playerId'] === playerId,
    );
    expect(row).toBeDefined();
    expect(typeof row!['minutesDisplay']).toBe('string');
    expect(typeof row!['teamOReb']).toBe('number');
    expect(typeof row!['teamDReb']).toBe('number');
    // teamFoulsByPeriod is a Record<period, count> — the PF above lands in period 1
    expect(row!['teamFoulsByPeriod']).toEqual({ '1': 1 });
  });
});
