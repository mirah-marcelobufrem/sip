import { Router, type Request } from 'express';
import { z } from 'zod';
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
  computeFourFactors,
  computePerMinutes,
  computePlayerStints,
  computeTeamEfficiency,
  classifyMatchupResult,
  computeMatchupSummary,
  formatMinutesPlayed,
} from '../../domain/stat-calculators.js';

const TREND_STAT_KEYS = ['pts', 'ast', 'reb', 'fgm', 'fga', 'stl', 'blk', 'to', 'pf', 'oreb', 'dreb'] as const;

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map((c) => [first, ...c]),
    ...combinations(rest, k),
  ];
}

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
// Query: dateFrom?, dateTo? (ISO-8601), per36? ('true')
router.get('/teams/:teamId/players/season-stats', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const QuerySchema = z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      per36: z.string().optional(),
      // N-13 — normalization base; 'per=40' is the FIBA-format default option,
      // legacy 'per36=true' keeps meaning per-36
      per: z.enum(['36', '40']).optional(),
    });
    const query = QuerySchema.parse(req.query);

    const db = getDb();
    const [players, allGames] = await Promise.all([
      new DrizzlePlayerRepository(db).findByTeam(req.params.teamId),
      new DrizzleGameRepository(db).findByTeam(req.params.teamId, { status: 'completed' }),
    ]);

    // Apply optional date filters
    const games = allGames.filter((g) => {
      if (query.dateFrom && g.date < new Date(query.dateFrom)) return false;
      if (query.dateTo && g.date > new Date(query.dateTo)) return false;
      return true;
    });

    const gameIds = new Set(games.map((g) => g.id));
    const perBase = query.per === '40' ? 40 : query.per === '36' || query.per36 === 'true' ? 36 : null;

    // N-01 — stint totals (minutes + plus/minus) accumulated across the
    // filtered games; one pass per game, shared by every player row below
    const stintTotalsByPlayer = new Map<string, { minSeconds: number; plusMinus: number }>();
    for (const game of games) {
      const [gameEvents, snapshots] = await Promise.all([
        new DrizzleStatEventRepository(db).findByGame(game.id),
        new DrizzleLineupSnapshotRepository(db).findByGame(game.id),
      ]);
      const stints = computePlayerStints(gameEvents, snapshots, game);
      for (const [pid, t] of stints) {
        const acc = stintTotalsByPlayer.get(pid) ?? { minSeconds: 0, plusMinus: 0 };
        acc.minSeconds += t.minSeconds;
        acc.plusMinus += t.plusMinus;
        stintTotalsByPlayer.set(pid, acc);
      }
    }

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
        const stintTotals = stintTotalsByPlayer.get(player.id);
        box.minSeconds = stintTotals?.minSeconds ?? 0;
        box.plusMinus = stintTotals?.plusMinus ?? 0;
        const derived = deriveStats(box);

        // I-04 — FIBA MET-1 minutes display. Season aggregate: the rounding
        // cap is the regulation length of one game times games played
        // (per-game settings taken from the first filtered game).
        const perGameMaxSeconds =
          (games[0]?.numPeriods ?? 4) * (games[0]?.periodDurationMinutes ?? 10) * 60;
        const minutesDisplay = formatMinutesPlayed(
          box.minSeconds,
          perGameMaxSeconds * Math.max(gamesPlayed, 1),
        );

        if (perBase !== null) {
          const normalized = computePerMinutes(box, perBase);
          if (normalized !== null) {
            // Replace counting stats with per-N-minutes values; keep derived stats as-is
            Object.assign(box, normalized);
          }
        }

        return { player, box, derived, gamesPlayed, minutesDisplay };
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
    if (games.length === 0) {
      res.json({ ortg: null, drtg: null, nrtg: null, pace: null, gamesPlayed: 0, fourFactors: null, fourFactorsOpp: null });
      return;
    }

    let totalTeamPts = 0, totalOppPts = 0, totalFga = 0, totalOreb = 0, totalTo = 0, totalFta = 0;

    // N-03 — four-factors totals (fga/fta = makes + misses; OREB/DREB counts
    // include team rebounds — both row kinds carry teamId)
    const ffOwn = { fgm: 0, threePm: 0, fga: 0, to: 0, fta: 0, oreb: 0, dreb: 0 };
    const ffOpp = { fgm: 0, threePm: 0, fga: 0, to: 0, fta: 0, oreb: 0, dreb: 0 };

    for (const game of games) {
      const events = await new DrizzleStatEventRepository(db).findByGame(game.id);
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

        const ff = isTeam ? ffOwn : e.teamId ? ffOpp : null;
        if (!ff) continue;
        switch (e.statType) {
          case '2PM': ff.fgm++; ff.fga++; break;
          case '3PM': ff.fgm++; ff.threePm++; ff.fga++; break;
          case '2PA': case '3PA': ff.fga++; break;
          case 'FTM': case 'FTA': ff.fta++; break;
          case 'TO': ff.to++; break;
          case 'OREB': ff.oreb++; break;
          case 'DREB': ff.dreb++; break;
        }
      }
    }

    const avgPeriodMinutes = games[0]?.periodDurationMinutes ?? 10;
    const avgPeriods = games[0]?.numPeriods ?? 4;
    const eff = computeTeamEfficiency(
      totalTeamPts, totalOppPts, totalFga, totalOreb, totalTo, totalFta,
      avgPeriodMinutes, avgPeriods,
    );
    res.json({
      ...eff,
      gamesPlayed: games.length,
      teamPts: totalTeamPts,
      oppPts: totalOppPts,
      fourFactors: computeFourFactors({ ...ffOwn, oppDreb: ffOpp.dreb }),
      fourFactorsOpp: computeFourFactors({ ...ffOpp, oppDreb: ffOwn.dreb }),
    });
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
    const [game, events, snapshots] = await Promise.all([
      new DrizzleGameRepository(db).findById(req.params.gameId),
      new DrizzleStatEventRepository(db).findByGame(req.params.gameId),
      new DrizzleLineupSnapshotRepository(db).findByGame(req.params.gameId),
    ]);
    // N-01 — stint-derived minutes + plus/minus
    const stints = computePlayerStints(events, snapshots, {
      numPeriods: game?.numPeriods ?? 4,
      periodDurationMinutes: game?.periodDurationMinutes ?? 10,
    });
    const playerMap = new Map<string, typeof events>();
    for (const e of events) {
      if (!e.playerId) continue;
      if (!playerMap.has(e.playerId)) playerMap.set(e.playerId, []);
      playerMap.get(e.playerId)!.push(e);
    }
    const rows = Array.from(playerMap.entries()).map(([playerId, playerEvents]) => {
      const box = aggregatePlayerEvents(playerEvents);
      const stint = stints.get(playerId);
      box.minSeconds = stint?.minSeconds ?? 0;
      box.plusMinus = stint?.plusMinus ?? 0;
      const derived = deriveStats(box);
      return { ...box, ...derived };
    });
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /teams/:teamId/trend-stats — per-game trend for a given stat
// Query: stat (required), playerId? (uuid)
router.get('/teams/:teamId/trend-stats', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const statKey = req.query.stat as string | undefined;
    if (!statKey || !(TREND_STAT_KEYS as readonly string[]).includes(statKey)) {
      res.status(400).json({
        error: `Query param 'stat' must be one of: ${TREND_STAT_KEYS.join(', ')}`,
        code: 'INVALID_STAT_KEY',
      });
      return;
    }

    const playerIdFilter = typeof req.query.playerId === 'string' ? req.query.playerId : undefined;

    const db = getDb();
    const games = await new DrizzleGameRepository(db).findByTeam(req.params.teamId, { status: 'completed' });
    const sortedGames = [...games].sort((a, b) => a.date.getTime() - b.date.getTime());

    const gameEntries = await Promise.all(
      sortedGames.map(async (game) => {
        const events = await new DrizzleStatEventRepository(db).findByGame(game.id);
        const teamEvents = events.filter((e) => e.teamId === req.params.teamId);

        const extractStat = (box: ReturnType<typeof aggregatePlayerEvents>): number => {
          // statKey is validated against TREND_STAT_KEYS above; all keys exist on PlayerBoxScore as numbers
          return (box as unknown as Record<string, number>)[statKey] ?? 0;
        };

        let value: number;
        if (playerIdFilter) {
          const playerEvents = teamEvents.filter((e) => e.playerId === playerIdFilter);
          const box = playerEvents.length > 0 ? aggregatePlayerEvents(playerEvents) : null;
          value = box ? extractStat(box) : 0;
        } else {
          // Sum across all players for team-level
          const playerMap = new Map<string, typeof teamEvents>();
          for (const e of teamEvents) {
            if (!e.playerId) continue;
            if (!playerMap.has(e.playerId)) playerMap.set(e.playerId, []);
            playerMap.get(e.playerId)!.push(e);
          }
          value = 0;
          for (const playerEvents of playerMap.values()) {
            const box = aggregatePlayerEvents(playerEvents);
            value += extractStat(box);
          }
        }

        return {
          gameId: game.id,
          gameDate: game.date.toISOString(),
          opponentLabel: game.notes ?? '',
          value,
        };
      }),
    );

    res.json({ statKey, games: gameEntries });
  } catch (err) { next(err); }
});

// GET /teams/:teamId/matchups — opponent history with W/L/avg breakdown
// Query: opponentName? (string)
router.get('/teams/:teamId/matchups', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const opponentName = typeof req.query.opponentName === 'string' ? req.query.opponentName : undefined;

    const db = getDb();
    const allGames = await new DrizzleGameRepository(db).findByTeam(req.params.teamId, { status: 'completed' });

    const filtered = opponentName
      ? allGames.filter((g) => g.notes?.toLowerCase().includes(opponentName.toLowerCase()))
      : allGames;

    // Sort descending by date
    const sortedGames = [...filtered].sort((a, b) => b.date.getTime() - a.date.getTime());

    const gameRows = sortedGames.map((game) => {
      const isHome = game.homeTeamId === req.params.teamId;
      const teamScore = isHome ? (game.finalScoreHome ?? 0) : (game.finalScoreAway ?? 0);
      const oppScore = isHome ? (game.finalScoreAway ?? 0) : (game.finalScoreHome ?? 0);
      return {
        gameId: game.id,
        date: game.date.toISOString(),
        opponentLabel: game.notes ?? '',
        teamScore,
        oppScore,
        result: classifyMatchupResult(teamScore, oppScore),
      };
    });

    const summary = computeMatchupSummary(gameRows);
    res.json({
      record: { wins: summary.wins, losses: summary.losses },
      avgScoreDiff: summary.avgScoreDiff,
      avgPts: summary.avgPts,
      avgOppPts: summary.avgOppPts,
      games: gameRows,
    });
  } catch (err) { next(err); }
});

// GET /teams/:teamId/combo-stats — 2-man or 3-man player combination stats
// Query: size? ('2'|'3', default '2'), minEvents? (default '5')
router.get('/teams/:teamId/combo-stats', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const sizeRaw = req.query.size === '3' ? 3 : 2;
    const minEvents = Math.max(1, parseInt(typeof req.query.minEvents === 'string' ? req.query.minEvents : '5', 10) || 5);

    const db = getDb();
    const games = await new DrizzleGameRepository(db).findByTeam(req.params.teamId, { status: 'completed' });

    const comboMap = new Map<string, { playerIds: string[]; eventCount: number; pts: number }>();

    for (const game of games) {
      const [events, snapshots] = await Promise.all([
        new DrizzleStatEventRepository(db).findByGame(game.id),
        new DrizzleLineupSnapshotRepository(db).findByGame(game.id),
      ]);

      // Index only snapshots belonging to this team
      const snapshotMap = new Map(
        snapshots
          .filter((s) => s.teamId === req.params.teamId)
          .map((s) => [s.id, s]),
      );

      for (const event of events) {
        if (!event.lineupSnapshotId) continue;
        const snapshot = snapshotMap.get(event.lineupSnapshotId);
        if (!snapshot) continue;

        const subsets = combinations([...snapshot.playerIds].sort(), sizeRaw);

        for (const subset of subsets) {
          const key = subset.join(',');
          if (!comboMap.has(key)) {
            comboMap.set(key, { playerIds: subset, eventCount: 0, pts: 0 });
          }
          const entry = comboMap.get(key)!;
          entry.eventCount++;
          if (event.statType === '2PM') entry.pts += 2;
          else if (event.statType === '3PM') entry.pts += 3;
          else if (event.statType === 'FTM') entry.pts += 1;
        }
      }
    }

    const result = Array.from(comboMap.values())
      .filter((c) => c.eventCount >= minEvents)
      .map((c) => ({
        playerIds: c.playerIds,
        eventsTogether: c.eventCount,
        pts: c.pts,
        ptsPer50: c.eventCount > 0 ? (c.pts * 50) / c.eventCount : 0,
      }))
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 15);

    res.json(result);
  } catch (err) { next(err); }
});

export default router;
