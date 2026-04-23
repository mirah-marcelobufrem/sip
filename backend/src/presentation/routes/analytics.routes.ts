import { Router, type Request } from 'express';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleStatEventRepository } from '../../infrastructure/database/repositories/stat-event.repository.js';
import { DrizzlePlayerRepository } from '../../infrastructure/database/repositories/player.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { aggregatePlayerEvents, deriveStats, classifyShotZone } from '../../domain/stat-calculators.js';

const router = Router();
router.use(authenticate);

router.get('/players/:playerId/shot-chart', async (req: Request<{ playerId: string }>, res, next) => {
  try {
    const db = getDb();
    const events = await new DrizzleStatEventRepository(db).findShotEvents({
      playerId: req.params.playerId,
    });
    const shots = events.map((e) => ({
      id: e.id,
      gameId: e.gameId,
      period: e.period,
      x: e.xCourt,
      y: e.yCourt,
      made: e.statType === '2PM' || e.statType === '3PM',
      isThree: e.statType === '3PM' || e.statType === '3PA',
      zone: e.xCourt !== null && e.yCourt !== null
        ? classifyShotZone(e.xCourt, e.yCourt)
        : null,
    }));
    res.json({ shots });
  } catch (err) {
    next(err);
  }
});

router.get('/teams/:teamId/players/:playerId/shot-chart', async (
  req: Request<{ teamId: string; playerId: string }>,
  res,
  next,
) => {
  try {
    const db = getDb();
    const player = await new DrizzlePlayerRepository(db).findById(req.params.playerId);
    if (!player || player.teamId !== req.params.teamId) {
      res.status(404).json({ error: 'Player not found', code: 'NOT_FOUND' });
      return;
    }
    const events = await new DrizzleStatEventRepository(db).findShotEvents({
      playerId: req.params.playerId,
    });
    const shots = events.map((e) => ({
      id: e.id,
      gameId: e.gameId,
      period: e.period,
      x: e.xCourt,
      y: e.yCourt,
      made: e.statType === '2PM' || e.statType === '3PM',
      isThree: e.statType === '3PM' || e.statType === '3PA',
      zone: e.xCourt !== null && e.yCourt !== null
        ? classifyShotZone(e.xCourt, e.yCourt)
        : null,
    }));
    res.json({ player, shots });
  } catch (err) {
    next(err);
  }
});

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
  } catch (err) {
    next(err);
  }
});

export default router;
