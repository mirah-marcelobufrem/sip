import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleGameRepository } from '../../infrastructure/database/repositories/game.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';
import type { Game } from '../../domain/entities/game.entity.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

const CreateGameBody = z.object({
  date: z.string().datetime().optional(),
  location: z.string().optional(),
  format: z.enum(['quarters', 'halves']).default('quarters'),
  numPeriods: z.number().int().min(2).max(4).default(4),
  periodDurationMinutes: z.number().int().min(1).max(20).default(10),
  foulLimitBonus: z.number().int().min(1).max(10).default(5),
  threePointEnabled: z.boolean().default(true),
  awayTeamId: z.string().uuid().optional(),
  awayOpponentTeamId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

router.get('/', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const db = getDb();
    const games = await new DrizzleGameRepository(db).findByTeam(req.params.teamId);
    res.json(games);
  } catch (err) { next(err); }
});

router.post('/', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const body = CreateGameBody.parse(req.body);
    const db = getDb();
    const game = await new DrizzleGameRepository(db).create({
      homeTeamId: req.params.teamId,
      awayTeamId: body.awayTeamId ?? null,
      homeOpponentTeamId: null,
      awayOpponentTeamId: body.awayOpponentTeamId ?? null,
      date: body.date ? new Date(body.date) : new Date(),
      location: body.location ?? null,
      format: body.format,
      numPeriods: body.numPeriods,
      periodDurationMinutes: body.periodDurationMinutes,
      foulLimitBonus: body.foulLimitBonus,
      threePointEnabled: body.threePointEnabled,
      currentPeriod: 1,
      status: 'scheduled',
      finalScoreHome: null,
      finalScoreAway: null,
      notes: body.notes ?? null,
    } as Omit<Game, 'id'>);
    res.status(201).json(game);
  } catch (err) { next(err); }
});

router.get('/season-stats', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const db = getDb();
    const games = await new DrizzleGameRepository(db).findByTeam(req.params.teamId, { status: 'completed' });
    const wins = games.filter((g) => {
      const isHome = g.homeTeamId === req.params.teamId;
      const home = g.finalScoreHome ?? 0;
      const away = g.finalScoreAway ?? 0;
      return isHome ? home > away : away > home;
    }).length;
    const losses = games.length - wins;
    const totalPts = games.reduce((acc, g) => {
      const isHome = g.homeTeamId === req.params.teamId;
      return acc + (isHome ? g.finalScoreHome ?? 0 : g.finalScoreAway ?? 0);
    }, 0);
    const totalOpp = games.reduce((acc, g) => {
      const isHome = g.homeTeamId === req.params.teamId;
      return acc + (isHome ? g.finalScoreAway ?? 0 : g.finalScoreHome ?? 0);
    }, 0);
    const n = games.length || 1;
    res.json({
      wins,
      losses,
      gamesPlayed: games.length,
      pointsPerGame: totalPts / n,
      pointsAllowedPerGame: totalOpp / n,
      teamFgPct: null,
    });
  } catch (err) { next(err); }
});

export default router;
