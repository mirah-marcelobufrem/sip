import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleGameRepository } from '../../infrastructure/database/repositories/game.repository.js';
import { DrizzleTournamentRepository } from '../../infrastructure/database/repositories/tournament.repository.js';
import { DrizzleTeamRepository } from '../../infrastructure/database/repositories/team.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { createGame } from '../../application/games/createGame.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

const GamesQuery = z.object({
  tournamentId: z.string().uuid().optional(),
});

router.get('/', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const { tournamentId } = GamesQuery.parse(req.query);
    const db = getDb();
    const games = await new DrizzleGameRepository(db).findByTeam(req.params.teamId, { tournamentId });
    res.json(games);
  } catch (err) { next(err); }
});

router.post('/', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const db = getDb();
    const game = await createGame(
      { ...req.body, teamId: req.params.teamId, userId: req.userId },
      new DrizzleGameRepository(db),
      new DrizzleTournamentRepository(db),
      new DrizzleTeamRepository(db),
    );
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
