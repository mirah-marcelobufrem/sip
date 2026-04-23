import { Router, type Request } from 'express';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleGameRepository } from '../../infrastructure/database/repositories/game.repository.js';
import { DrizzleStatEventRepository } from '../../infrastructure/database/repositories/stat-event.repository.js';
import { DrizzlePlayerRepository } from '../../infrastructure/database/repositories/player.repository.js';
import { DrizzleLineupSnapshotRepository } from '../../infrastructure/database/repositories/lineup-snapshot.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  aggregatePlayerEvents,
  deriveStats,
  classifyShotZone,
  computeTeamEfficiency,
} from '../../domain/stat-calculators.js';

const router = Router();
router.use(authenticate);

// GET /players/:playerId/shot-chart
router.get('/players/:playerId/shot-chart', async (req: Request<{ playerId: string }>, res, next) => {
  try {
    const db = getDb();
    const events = await new DrizzleStatEventRepository(db).findShotEvents({ playerId: req.params.playerId });
    const shots = events.map((e) => ({
      id: e.id,
      gameId: e.gameId,
      period: e.period,
      x: e.xCourt,
      y: e.yCourt,
      made: e.statType === '2PM' || e.statType === '3PM',
      isThree: e.statType === '3PM' || e.statType === '3PA',
      zone: e.xCourt !== null && e.yCourt !== null ? classifyShotZone(e.xCourt, e.yCourt) : null,
    }));
    res.json({ shots });
  } catch (err) { next(err); }
});

// GET /teams/:teamId/players/season-stats — season aggregates per player
router.get('/teams/:teamId/players/season-stats', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const db = getDb();
    const [players, games] = await Promise.all([
      new DrizzlePlayerRepository(db).findByTeam(req.params.teamId),
      new DrizzleGameRepository(db).findByTeam(req.params.teamId, { status: 'completed' }),
    ]);

    const gameIds = new Set(games.map((g) => g.id));
    const rows = await Promise.all(
      players.map(async (player) => {
        const events = await new DrizzleStatEventRepository(db).findByPlayer(player.id);
        const gameEvents = events.filter((e) => gameIds.has(e.gameId));
        if (gameEvents.length === 0) {
          return { player, box: null, derived: null, gamesPlayed: 0 };
        }
        const box = aggregatePlayerEvents(gameEvents);
        const gamesPlayed = new Set(gameEvents.map((e) => e.gameId)).size;
        box.gamesPlayed = gamesPlayed;
        const derived = deriveStats(box);
        return { player, box, derived, gamesPlayed };
      }),
    );

    res.json(rows.filter((r) => r.gamesPlayed > 0));
  } catch (err) { next(err); }
});

// GET /teams/:teamId/lineup-stats — 5-man lineup analysis
router.get('/teams/:teamId/lineup-stats', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const db = getDb();
    const games = await new DrizzleGameRepository(db).findByTeam(req.params.teamId, { status: 'completed' });

    const lineupStats = new Map<string, {
      playerIds: string[];
      pts: number;
      oppPts: number;
      possessions: number;
      eventCount: number;
    }>();

    for (const game of games) {
      const [events, snapshots] = await Promise.all([
        new DrizzleStatEventRepository(db).findByGame(game.id),
        new DrizzleLineupSnapshotRepository(db).findByGame(game.id),
      ]);

      const snapshotMap = new Map(snapshots.map((s) => [s.id, s]));

      for (const event of events) {
        if (!event.lineupSnapshotId) continue;
        const snapshot = snapshotMap.get(event.lineupSnapshotId);
        if (!snapshot || snapshot.teamId !== req.params.teamId) continue;

        const key = [...snapshot.playerIds].sort().join(',');
        if (!lineupStats.has(key)) {
          lineupStats.set(key, { playerIds: snapshot.playerIds, pts: 0, oppPts: 0, possessions: 0, eventCount: 0 });
        }
        const entry = lineupStats.get(key)!;
        entry.eventCount++;
        if (event.statType === '2PM') entry.pts += 2;
        else if (event.statType === '3PM') entry.pts += 3;
        else if (event.statType === 'FTM') entry.pts += 1;
        else if (event.statType === 'TO' || event.statType === '2PA' || event.statType === '3PA' || event.statType === 'FTA') {
          entry.possessions++;
        }
      }
    }

    const result = Array.from(lineupStats.values())
      .filter((l) => l.eventCount >= 5)
      .map((l) => ({
        playerIds: l.playerIds,
        pts: l.pts,
        plusMinus: l.pts - l.oppPts,
        ortg: l.possessions > 0 ? (100 * l.pts) / l.possessions : null,
      }))
      .sort((a, b) => b.plusMinus - a.plusMinus)
      .slice(0, 20);

    res.json(result);
  } catch (err) { next(err); }
});

// GET /teams/:teamId/on-off/:playerId — on/off splits
router.get('/teams/:teamId/on-off/:playerId', async (
  req: Request<{ teamId: string; playerId: string }>,
  res,
  next,
) => {
  try {
    const db = getDb();
    const games = await new DrizzleGameRepository(db).findByTeam(req.params.teamId, { status: 'completed' });

    let onPts = 0, offPts = 0, onOppPts = 0, offOppPts = 0;
    let onMinutes = 0, offMinutes = 0;

    for (const game of games) {
      const [events, snapshots] = await Promise.all([
        new DrizzleStatEventRepository(db).findByGame(game.id),
        new DrizzleLineupSnapshotRepository(db).findByGame(game.id),
      ]);

      const snapshotMap = new Map(snapshots.map((s) => [s.id, s]));

      for (const event of events) {
        if (event.teamId !== req.params.teamId) continue;
        const snapshot = event.lineupSnapshotId ? snapshotMap.get(event.lineupSnapshotId) : null;
        const isOn = snapshot?.playerIds.includes(req.params.playerId) ?? false;
        const pts = event.statType === '2PM' ? 2 : event.statType === '3PM' ? 3 : event.statType === 'FTM' ? 1 : 0;
        if (isOn) onPts += pts; else offPts += pts;
      }
    }

    res.json({
      playerId: req.params.playerId,
      on: { pts: onPts, oppPts: onOppPts, plusMinus: onPts - onOppPts, minutes: onMinutes },
      off: { pts: offPts, oppPts: offOppPts, plusMinus: offPts - offOppPts, minutes: offMinutes },
      netRatingDiff: null,
    });
  } catch (err) { next(err); }
});

// GET /teams/:teamId/efficiency — team efficiency metrics
router.get('/teams/:teamId/efficiency', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const db = getDb();
    const games = await new DrizzleGameRepository(db).findByTeam(req.params.teamId, { status: 'completed' });
    if (games.length === 0) { res.json({ ortg: null, drtg: null, nrtg: null, pace: null, gamesPlayed: 0 }); return; }

    let totalTeamPts = 0, totalOppPts = 0, totalFga = 0, totalOreb = 0, totalTo = 0, totalFta = 0;

    for (const game of games) {
      const events = await new DrizzleStatEventRepository(db).findByGame(game.id);
      const teamEvents = events.filter((e) => e.teamId === req.params.teamId || game.homeTeamId === req.params.teamId);
      for (const e of events) {
        const isTeam = e.teamId === req.params.teamId;
        if (isTeam) {
          if (e.statType === '2PM') totalTeamPts += 2;
          else if (e.statType === '3PM') totalTeamPts += 3;
          else if (e.statType === 'FTM') totalTeamPts += 1;
          else if (e.statType === '2PA' || e.statType === '3PA') totalFga++;
          else if (e.statType === 'OREB') totalOreb++;
          else if (e.statType === 'TO') totalTo++;
          else if (e.statType === 'FTA') totalFta++;
        } else {
          if (e.statType === '2PM') totalOppPts += 2;
          else if (e.statType === '3PM') totalOppPts += 3;
          else if (e.statType === 'FTM') totalOppPts += 1;
        }
      }
      void teamEvents;
    }

    const avgPeriodMinutes = games[0]?.periodDurationMinutes ?? 10;
    const avgPeriods = games[0]?.numPeriods ?? 4;
    const eff = computeTeamEfficiency(
      totalTeamPts, totalOppPts, totalFga, totalOreb, totalTo, totalFta,
      avgPeriodMinutes, avgPeriods,
    );
    res.json({ ...eff, gamesPlayed: games.length, teamPts: totalTeamPts, oppPts: totalOppPts });
  } catch (err) { next(err); }
});

// GET /teams/:teamId/players/:playerId/shot-chart
router.get('/teams/:teamId/players/:playerId/shot-chart', async (
  req: Request<{ teamId: string; playerId: string }>,
  res,
  next,
) => {
  try {
    const db = getDb();
    const player = await new DrizzlePlayerRepository(db).findById(req.params.playerId);
    if (!player || player.teamId !== req.params.teamId) {
      res.status(404).json({ error: 'Player not found', code: 'NOT_FOUND' }); return;
    }
    const events = await new DrizzleStatEventRepository(db).findShotEvents({ playerId: req.params.playerId });
    const shots = events.map((e) => ({
      id: e.id,
      gameId: e.gameId,
      period: e.period,
      x: e.xCourt,
      y: e.yCourt,
      made: e.statType === '2PM' || e.statType === '3PM',
      isThree: e.statType === '3PM' || e.statType === '3PA',
      zone: e.xCourt !== null && e.yCourt !== null ? classifyShotZone(e.xCourt, e.yCourt) : null,
    }));
    res.json({ player, shots });
  } catch (err) { next(err); }
});

// GET /games/:gameId/player-stats — per-player box score for one game
router.get('/games/:gameId/player-stats', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const db = getDb();
    const events = await new DrizzleStatEventRepository(db).findByGame(req.params.gameId);
    const playerMap = new Map<string, typeof events>();
    for (const e of events) {
      if (!e.playerId) continue;
      if (!playerMap.has(e.playerId)) playerMap.set(e.playerId, []);
      playerMap.get(e.playerId)!.push(e);
    }
    const rows = Array.from(playerMap.entries()).map(([, playerEvents]) => {
      const box = aggregatePlayerEvents(playerEvents);
      const derived = deriveStats(box);
      return { ...box, ...derived };
    });
    res.json(rows);
  } catch (err) { next(err); }
});

export default router;
