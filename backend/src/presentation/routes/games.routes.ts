import { Router, type Request } from 'express';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleGameRepository } from '../../infrastructure/database/repositories/game.repository.js';
import { DrizzleStatEventRepository } from '../../infrastructure/database/repositories/stat-event.repository.js';
import { DrizzleLineupSnapshotRepository } from '../../infrastructure/database/repositories/lineup-snapshot.repository.js';
import { DrizzlePossessionSequenceRepository } from '../../infrastructure/database/repositories/possession.repository.js';
import { recordStatEvent, RecordStatEventInput } from '../../application/games/recordStatEvent.js';
import { recordSubstitution, RecordSubstitutionInput } from '../../application/games/recordSubstitution.js';
import { deleteStatEvent } from '../../application/games/deleteStatEvent.js';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  aggregatePlayerEvents,
  aggregateTeamRebounds,
  attachLinkedChildren,
  deriveStats,
  detectScoringRuns,
  buildGameFlowPoints,
  formatMinutesPlayed,
  getTeamFoulCountForPeriod,
  isTeamInBonus,
} from '../../domain/stat-calculators.js';
import { players as playersTable } from '../../infrastructure/database/schema/players.schema.js';
import { opponentPlayers as opponentPlayersTable } from '../../infrastructure/database/schema/opponents.schema.js';
import { statEventAudits } from '../../infrastructure/database/schema/stat-events.schema.js';
import { userTeamRoles } from '../../infrastructure/database/schema/users.schema.js';

const router = Router();

router.use(authenticate);

// Verify the caller is a member of the game's home team (any role).
// Games without a homeTeamId skip the check, matching the PATCH route.
async function checkGameMembership(
  db: ReturnType<typeof getDb>,
  userId: string,
  gameId: string,
): Promise<'not_found' | 'forbidden' | 'ok'> {
  const game = await new DrizzleGameRepository(db).findById(gameId);
  if (!game) return 'not_found';
  if (!game.homeTeamId) return 'ok';

  const roleRows = await db
    .select()
    .from(userTeamRoles)
    .where(
      and(
        eq(userTeamRoles.userId, userId),
        eq(userTeamRoles.teamId, game.homeTeamId),
      ),
    )
    .limit(1);
  return roleRows.length > 0 ? 'ok' : 'forbidden';
}

router.post('/:gameId/events', async (req, res, next) => {
  try {
    const db = getDb();

    const membership = await checkGameMembership(db, req.userId, req.params.gameId);
    if (membership === 'not_found') {
      res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
      return;
    }
    if (membership === 'forbidden') {
      res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }

    const { insertAfterId, ...bodyRest } = req.body as Record<string, unknown>;
    const repo = new DrizzleStatEventRepository(db);

    let computedSeq: number | undefined;

    if (typeof insertAfterId === 'string') {
      const afterEventId = z.string().uuid().parse(insertAfterId);
      const afterEvent = await repo.findById(afterEventId);

      if (!afterEvent || afterEvent.gameId !== req.params.gameId) {
        res.status(404).json({ error: 'Reference event not found', code: 'NOT_FOUND' });
        return;
      }

      // Load all events in the same period ordered by seq (nulls last) then createdAt
      const periodEvents = await repo.findByGameAndPeriod(req.params.gameId, afterEvent.period);
      const afterIndex = periodEvents.findIndex((e) => e.id === afterEventId);

      const afterSeq = afterEvent.seq ?? afterEvent.createdAt.getTime();
      const nextEvent = afterIndex >= 0 ? periodEvents[afterIndex + 1] : undefined;

      if (nextEvent) {
        const nextSeq = nextEvent.seq ?? nextEvent.createdAt.getTime();
        computedSeq = (afterSeq + nextSeq) / 2.0;

        // Guard against precision exhaustion: if gap is too small, re-sequence the period
        if (Math.abs(computedSeq - afterSeq) < 0.001) {
          // Assign seq = rowNumber * 1000 to all events in this period
          await Promise.all(
            periodEvents.map((e, idx) => repo.update(e.id, { seq: (idx + 1) * 1000 })),
          );
          // Recalculate after re-sequencing
          const reAfter = await repo.findById(afterEventId);
          const reNext = periodEvents[afterIndex + 1];
          const reAfterSeq = reAfter?.seq ?? (afterIndex + 1) * 1000;
          const reNextSeq = reNext?.seq ?? (afterIndex + 2) * 1000;
          computedSeq = (reAfterSeq + reNextSeq) / 2.0;
        }
      } else {
        computedSeq = afterSeq + 1000;
      }
    }

    const input = RecordStatEventInput.parse({
      ...bodyRest,
      gameId: req.params.gameId,
      ...(computedSeq !== undefined ? { seq: computedSeq } : {}),
    });

    const event = await recordStatEvent(
      input,
      repo,
      new DrizzleLineupSnapshotRepository(db),
      new DrizzleGameRepository(db),
      new DrizzlePossessionSequenceRepository(db),
    );
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

router.delete('/:gameId/events/:eventId', async (req, res, next) => {
  try {
    const db = getDb();

    const membership = await checkGameMembership(db, req.userId, req.params.gameId);
    if (membership === 'not_found') {
      res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
      return;
    }
    if (membership === 'forbidden') {
      res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
      return;
    }

    const { deletedIds } = await deleteStatEvent(
      { gameId: req.params.gameId, eventId: req.params.eventId },
      new DrizzleStatEventRepository(db),
    );
    res.json({ deletedIds });
  } catch (err) {
    next(err);
  }
});

const PatchEventBody = z.object({
  playerId: z.string().uuid().optional(),
  statType: z.enum([
    '2PM', '2PA', '3PM', '3PA', 'FTM', 'FTA',
    'OREB', 'DREB', 'AST', 'TO', 'STL', 'BLK', 'DFD',
    'PF', 'TF', 'FF', 'SUB_IN', 'SUB_OUT',
    'PERIOD_START', 'PERIOD_END', 'TIMEOUT',
  ]).optional(),
  clockSeconds: z.number().int().min(0).optional(),
  teamId: z.string().uuid().optional(),
});

router.patch(
  '/:gameId/events/:eventId',
  async (req: Request<{ gameId: string; eventId: string }>, res, next) => {
    try {
      const body = PatchEventBody.parse(req.body);
      const db = getDb();

      // Verify user has OWNER or COACH role on the game's home team
      const gameRepo = new DrizzleGameRepository(db);
      const game = await gameRepo.findById(req.params.gameId);
      if (!game) {
        res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' });
        return;
      }

      const teamId = game.homeTeamId;
      if (teamId) {
        const roleRows = await db
          .select()
          .from(userTeamRoles)
          .where(
            and(
              eq(userTeamRoles.userId, req.userId),
              eq(userTeamRoles.teamId, teamId),
            ),
          )
          .limit(1);

        const role = roleRows[0]?.role;
        if (!role || !['OWNER', 'COACH'].includes(role)) {
          res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN' });
          return;
        }
      }

      const repo = new DrizzleStatEventRepository(db);
      const existing = await repo.findById(req.params.eventId);
      if (!existing || existing.gameId !== req.params.gameId) {
        res.status(404).json({ error: 'Event not found', code: 'NOT_FOUND' });
        return;
      }

      // Write audit row before applying the update
      await db.insert(statEventAudits).values({
        eventId: req.params.eventId,
        editorUserId: req.userId,
        originalValue: {
          playerId: existing.playerId,
          statType: existing.statType,
          clockTimeSeconds: existing.clockTimeSeconds,
          teamId: existing.teamId,
        },
        newValue: {
          playerId: body.playerId ?? existing.playerId,
          statType: body.statType ?? existing.statType,
          clockTimeSeconds: body.clockSeconds ?? existing.clockTimeSeconds,
          teamId: body.teamId ?? existing.teamId,
        },
        editedAt: new Date(),
      });

      const updates: Parameters<typeof repo.update>[1] = {};
      if (body.playerId !== undefined) updates.playerId = body.playerId;
      if (body.statType !== undefined) updates.statType = body.statType;
      if (body.clockSeconds !== undefined) updates.clockTimeSeconds = body.clockSeconds;
      if (body.teamId !== undefined) updates.teamId = body.teamId;

      const updated = await repo.update(req.params.eventId, updates);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

router.post('/:gameId/lineups/initial', async (req, res, next) => {
  try {
    const input = z.object({
      teamId: z.string().uuid(),
      playerIds: z.array(z.string().uuid()).min(1).max(5),
    }).parse(req.body);
    const db = getDb();
    const snapshot = await new DrizzleLineupSnapshotRepository(db).create({
      gameId: req.params.gameId,
      teamId: input.teamId,
      playerIds: input.playerIds,
      period: 1,
      clockTimeSeconds: 0,
    });
    res.status(201).json(snapshot);
  } catch (err) { next(err); }
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
    res.json(attachLinkedChildren(events));
  } catch (err) {
    next(err);
  }
});

router.get('/:gameId/box-score', async (req, res, next) => {
  try {
    const db = getDb();
    const [game, events] = await Promise.all([
      new DrizzleGameRepository(db).findById(req.params.gameId),
      new DrizzleStatEventRepository(db).findByGame(req.params.gameId),
    ]);

    const playerMap = new Map<string, { events: typeof events; teamId: string | null }>();
    for (const e of events) {
      if (!e.playerId) continue;
      if (!playerMap.has(e.playerId)) playerMap.set(e.playerId, { events: [], teamId: e.teamId });
      playerMap.get(e.playerId)!.events.push(e);
    }

    const playerIds = Array.from(playerMap.keys());
    let nameMap = new Map<string, { firstName: string; lastName: string; jerseyNumber: number | null }>();
    if (playerIds.length > 0) {
      const ownRows = await db.select({
        id: playersTable.id,
        firstName: playersTable.firstName,
        lastName: playersTable.lastName,
        jerseyNumber: playersTable.jerseyNumber,
      }).from(playersTable).where(inArray(playersTable.id, playerIds));
      for (const r of ownRows) nameMap.set(r.id, r);

      const oppRows = await db.select({
        id: opponentPlayersTable.id,
        firstName: opponentPlayersTable.firstName,
        lastName: opponentPlayersTable.lastName,
        jerseyNumber: opponentPlayersTable.jerseyNumber,
      }).from(opponentPlayersTable).where(inArray(opponentPlayersTable.id, playerIds));
      for (const r of oppRows) nameMap.set(r.id, r);
    }

    // I-04 — FIBA MET-1 minutes formatting needs the game's regulation length
    const gameMaxSeconds =
      (game?.numPeriods ?? 4) * (game?.periodDurationMinutes ?? 10) * 60;

    // I-05/I-06 — per-team aggregates (team rebounds + fouls per period).
    // The response stays an array of player rows (frontend contract); the
    // team-level values are repeated on every row of that team.
    const periods = Array.from(new Set(events.map((e) => e.period))).sort((a, b) => a - b);
    const teamAggregates = new Map<
      string,
      { teamOReb: number; teamDReb: number; teamFoulsByPeriod: Record<number, number> }
    >();
    const teamIds = new Set(events.map((e) => e.teamId).filter((t): t is string => t !== null));
    for (const tid of teamIds) {
      const teamFoulsByPeriod: Record<number, number> = {};
      for (const p of periods) teamFoulsByPeriod[p] = getTeamFoulCountForPeriod(events, tid, p);
      teamAggregates.set(tid, { ...aggregateTeamRebounds(events, tid), teamFoulsByPeriod });
    }

    const boxScores = Array.from(playerMap.entries()).map(([playerId, { events: playerEvents, teamId }]) => {
      const box = aggregatePlayerEvents(playerEvents);
      const derived = deriveStats(box);
      const info = nameMap.get(playerId);
      const isHomeTeam = teamId === game?.homeTeamId;
      const teamAgg = teamId ? teamAggregates.get(teamId) : undefined;
      return {
        ...box,
        ...derived,
        teamId,
        isHomeTeam,
        playerName: info ? `${info.firstName} ${info.lastName}` : null,
        jerseyNumber: info?.jerseyNumber ?? null,
        minutesDisplay: formatMinutesPlayed(box.minSeconds, gameMaxSeconds),
        teamOReb: teamAgg?.teamOReb ?? 0,
        teamDReb: teamAgg?.teamDReb ?? 0,
        teamFoulsByPeriod: teamAgg?.teamFoulsByPeriod ?? {},
      };
    });

    res.json(boxScores);
  } catch (err) {
    next(err);
  }
});

router.get('/:gameId/flow', async (req: Request<{ gameId: string }>, res, next) => {
  try {
    const db = getDb();
    const [game, events] = await Promise.all([
      new DrizzleGameRepository(db).findById(req.params.gameId),
      new DrizzleStatEventRepository(db).findByGame(req.params.gameId),
    ]);
    if (!game) { res.status(404).json({ error: 'Game not found', code: 'NOT_FOUND' }); return; }
    const flowPoints = buildGameFlowPoints(events, game.homeTeamId ?? '');
    const scoringRuns = detectScoringRuns(events, 5);
    res.json({ flowPoints, scoringRuns });
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

    // I-06 — team-foul / bonus state for the game's current period
    const events = await new DrizzleStatEventRepository(db).findByGame(req.params.gameId);
    const homeId = game.homeTeamId ?? game.homeOpponentTeamId;
    const awayId = game.awayTeamId ?? game.awayOpponentTeamId;
    const period = game.currentPeriod;

    const homeTeamFoulsThisPeriod = homeId ? getTeamFoulCountForPeriod(events, homeId, period) : 0;
    const awayTeamFoulsThisPeriod = awayId ? getTeamFoulCountForPeriod(events, awayId, period) : 0;

    res.json({
      ...game,
      homeTeamFoulsThisPeriod,
      awayTeamFoulsThisPeriod,
      homeInBonus: homeId ? isTeamInBonus(events, homeId, period) : false,
      awayInBonus: awayId ? isTeamInBonus(events, awayId, period) : false,
    });
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
