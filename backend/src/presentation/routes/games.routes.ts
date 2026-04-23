import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleGameRepository } from '../../infrastructure/database/repositories/game.repository.js';
import { DrizzleStatEventRepository } from '../../infrastructure/database/repositories/stat-event.repository.js';
import { DrizzleLineupSnapshotRepository } from '../../infrastructure/database/repositories/lineup-snapshot.repository.js';
import { recordStatEvent, RecordStatEventInput } from '../../application/games/recordStatEvent.js';
import { recordSubstitution, RecordSubstitutionInput } from '../../application/games/recordSubstitution.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { aggregatePlayerEvents, deriveStats, detectScoringRuns } from '../../domain/stat-calculators.js';

const router = Router();

router.use(authenticate);

router.post('/:gameId/events', async (req, res, next) => {
  try {
    const input = RecordStatEventInput.parse({ ...req.body, gameId: req.params.gameId });
    const db = getDb();
    const event = await recordStatEvent(
      input,
      new DrizzleStatEventRepository(db),
      new DrizzleLineupSnapshotRepository(db),
    );
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

router.delete('/:gameId/events/:eventId', async (req, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleStatEventRepository(db);
    const event = await repo.findById(req.params.eventId);
    if (!event || event.gameId !== req.params.gameId) {
      res.status(404).json({ error: 'Event not found', code: 'NOT_FOUND' });
      return;
    }
    await repo.softDelete(req.params.eventId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post('/:gameId/lineups', async (req, res, next) => {
  try {
    const input = RecordSubstitutionInput.parse({ ...req.body, gameId: req.params.gameId });
    const db = getDb();
    const snapshot = await recordSubstitution(
      input,
      new DrizzleStatEventRepository(db),
      new DrizzleLineupSnapshotRepository(db),
    );
    res.status(201).json(snapshot);
  } catch (err) {
    next(err);
  }
});

router.get('/:gameId/log', async (req, res, next) => {
  try {
    const db = getDb();
    const events = await new DrizzleStatEventRepository(db).findByGame(req.params.gameId);
    res.json(events);
  } catch (err) {
    next(err);
  }
});

router.get('/:gameId/box-score', async (req, res, next) => {
  try {
    const db = getDb();
    const events = await new DrizzleStatEventRepository(db).findByGame(req.params.gameId);

    const playerMap = new Map<string, typeof events>();
    for (const e of events) {
      if (!e.playerId) continue;
      if (!playerMap.has(e.playerId)) playerMap.set(e.playerId, []);
      playerMap.get(e.playerId)!.push(e);
    }

    const boxScores = Array.from(playerMap.entries()).map(([playerId, playerEvents]) => {
      const box = aggregatePlayerEvents(playerEvents);
      const derived = deriveStats(box);
      return { ...box, ...derived };
    });

    res.json(boxScores);
  } catch (err) {
    next(err);
  }
});

router.get('/:gameId/flow', async (req, res, next) => {
  try {
    const db = getDb();
    const events = await new DrizzleStatEventRepository(db).findByGame(req.params.gameId);

    const runs = detectScoringRuns(events, 5);

    const flowPoints: { period: number; clock: number | null; homeScore: number; awayScore: number }[] = [];

    res.json({ flowPoints, scoringRuns: runs });
  } catch (err) {
    next(err);
  }
});

router.get('/:gameId/lineups', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const db = getDb();
    const lineups = await new DrizzleLineupSnapshotRepository(db).findByGame(req.params.gameId);
    res.json(lineups);
  } catch (err) {
    next(err);
  }
});

router.get('/:gameId', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const db = getDb();
    const game = await new DrizzleGameRepository(db).findById(req.params.gameId);
    if (!game) { res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' }); return; }
    res.json(game);
  } catch (err) {
    next(err);
  }
});

const PatchGameBody = z.object({
  currentPeriod: z.number().int().min(1).optional(),
  status: z.enum(['scheduled', 'live', 'completed', 'cancelled']).optional(),
  finalScoreHome: z.number().int().min(0).optional(),
  finalScoreAway: z.number().int().min(0).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

router.patch('/:gameId', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const body = PatchGameBody.parse(req.body);
    const db = getDb();
    const game = await new DrizzleGameRepository(db).update(req.params.gameId, body);
    res.json(game);
  } catch (err) {
    next(err);
  }
});

router.post('/:gameId/start', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const db = getDb();
    const game = await new DrizzleGameRepository(db).update(req.params.gameId, { status: 'live' });
    res.json(game);
  } catch (err) {
    next(err);
  }
});

router.post('/:gameId/complete', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const body = z.object({
      finalScoreHome: z.number().int().min(0),
      finalScoreAway: z.number().int().min(0),
    }).parse(req.body);
    const db = getDb();
    const game = await new DrizzleGameRepository(db).update(req.params.gameId, {
      status: 'completed',
      finalScoreHome: body.finalScoreHome,
      finalScoreAway: body.finalScoreAway,
    });
    res.json(game);
  } catch (err) {
    next(err);
  }
});

export default router;
