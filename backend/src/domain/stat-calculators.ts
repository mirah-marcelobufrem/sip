import type { StatEvent, StatType } from './entities/game.entity.js';

export interface PlayerBoxScore {
  playerId: string;
  gameId?: string;
  gamesPlayed: number;
  pts: number;
  fgm: number; fga: number;
  twopm: number; twopa: number;
  threepm: number; threepa: number;
  ftm: number; fta: number;
  oreb: number; dreb: number; reb: number;
  ast: number; to: number;
  stl: number; blk: number; dfd: number;
  pf: number; tf: number; ff: number;
  minSeconds: number;
  plusMinus: number;
}

export interface DerivedStats {
  fgPct: number | null;
  threePct: number | null;
  ftPct: number | null;
  efgPct: number | null;
  tsPct: number | null;
  astToRatio: number | null;
  per: number | null;
  ptsPerGame: number;
  rebPerGame: number;
  astPerGame: number;
  pts36: number | null;
  reb36: number | null;
  ast36: number | null;
}

const SHOT_MADE_TYPES: StatType[] = ['2PM', '3PM'];
const SHOT_ATTEMPTED_TYPES: StatType[] = ['2PM', '2PA', '3PM', '3PA'];
const FT_MADE_TYPES: StatType[] = ['FTM'];

export function aggregatePlayerEvents(events: StatEvent[]): PlayerBoxScore {
  const box: PlayerBoxScore = {
    playerId: events[0]?.playerId ?? '',
    gameId: events[0]?.gameId,
    gamesPlayed: 1,
    pts: 0, fgm: 0, fga: 0,
    twopm: 0, twopa: 0, threepm: 0, threepa: 0,
    ftm: 0, fta: 0,
    oreb: 0, dreb: 0, reb: 0,
    ast: 0, to: 0,
    stl: 0, blk: 0, dfd: 0,
    pf: 0, tf: 0, ff: 0,
    minSeconds: 0, plusMinus: 0,
  };

  for (const e of events) {
    switch (e.statType) {
      case '2PM': box.twopm++; box.pts += 2; break;
      case '2PA': box.twopa++; break;
      case '3PM': box.threepm++; box.pts += 3; break;
      case '3PA': box.threepa++; break;
      case 'FTM': box.ftm++; box.pts++; break;
      case 'FTA': box.fta++; break;
      case 'OREB': box.oreb++; break;
      case 'DREB': box.dreb++; break;
      case 'AST': box.ast++; break;
      case 'TO': box.to++; break;
      case 'STL': box.stl++; break;
      case 'BLK': box.blk++; break;
      case 'DFD': box.dfd++; break;
      case 'PF': box.pf++; break;
      case 'TF': box.tf++; break;
      case 'FF': box.ff++; break;
    }
  }

  box.fgm = box.twopm + box.threepm;
  box.fga = box.twopm + box.twopa + box.threepm + box.threepa; // made shots are also attempts
  box.reb = box.oreb + box.dreb;

  return box;
}

export function deriveStats(box: PlayerBoxScore): DerivedStats {
  const minPlayed = box.minSeconds / 60;

  const fgPct = box.fga > 0 ? box.fgm / box.fga : null;
  const threePct = box.threepa > 0 ? box.threepm / box.threepa : null;
  const ftPct = box.fta > 0 ? box.ftm / box.fta : null;
  const efgPct = box.fga > 0 ? (box.fgm + 0.5 * box.threepm) / box.fga : null;
  const tsPct =
    box.fga + 0.44 * box.fta > 0
      ? box.pts / (2 * (box.fga + 0.44 * box.fta))
      : null;
  const astToRatio = box.to > 0 ? box.ast / box.to : null;

  const missedFg = box.fga - box.fgm;
  const missedFt = box.fta - box.ftm;
  const per =
    minPlayed > 0
      ? (box.pts + box.reb + box.ast + box.stl + box.blk - box.to - missedFg - missedFt) / minPlayed
      : null;

  const pts36 = minPlayed >= 5 ? (box.pts / minPlayed) * 36 : null;
  const reb36 = minPlayed >= 5 ? (box.reb / minPlayed) * 36 : null;
  const ast36 = minPlayed >= 5 ? (box.ast / minPlayed) * 36 : null;

  return {
    fgPct, threePct, ftPct, efgPct, tsPct, astToRatio, per,
    ptsPerGame: box.pts / Math.max(box.gamesPlayed, 1),
    rebPerGame: box.reb / Math.max(box.gamesPlayed, 1),
    astPerGame: box.ast / Math.max(box.gamesPlayed, 1),
    pts36, reb36, ast36,
  };
}

export function classifyShotZone(x: number, y: number): string {
  // FIBA half-court: x∈[0,1] over 15 m width, y∈[0,1] over 14 m depth.
  // Basket center: 1.575 m from baseline → (0.5, 0.113).
  const dx = (x - 0.5) * 15;   // physical metres, x-axis
  const dy = (y - 0.113) * 14; // physical metres, y-axis
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Restricted area: 1.25 m arc
  if (dist < 1.25) return 'restricted_area';

  // Paint (key): 4.9 m wide (±2.45 m), 5.8 m deep
  if (x > 0.337 && x < 0.663 && y < 0.414) return 'paint';

  // 3-point boundary: 6.75 m arc + corner straights at x=0.06/0.94 up to y=0.213
  const isThreePoint =
    dist > 6.75 ||
    (x < 0.06 && y < 0.213) ||
    (x > 0.94 && y < 0.213);

  if (!isThreePoint) {
    if (x < 0.4) return 'mid_range_left';
    if (x > 0.6) return 'mid_range_right';
    return 'mid_range_center';
  }

  if (x < 0.06) return 'left_corner_3';
  if (x > 0.94) return 'right_corner_3';
  if (x < 0.35) return 'left_wing_3';
  if (x > 0.65) return 'right_wing_3';
  return 'top_arc_3';
}

export interface TeamEfficiency {
  ortg: number | null;
  drtg: number | null;
  nrtg: number | null;
  pace: number | null;
  possessions: number;
}

export function computeTeamEfficiency(
  teamPts: number,
  oppPts: number,
  teamFga: number,
  teamOreb: number,
  teamTo: number,
  teamFta: number,
  periodDurationMinutes: number,
  numPeriods: number,
): TeamEfficiency {
  const totalMinutes = periodDurationMinutes * numPeriods;
  const possessions = teamFga - teamOreb + teamTo + 0.44 * teamFta;
  if (possessions <= 0) return { ortg: null, drtg: null, nrtg: null, pace: null, possessions: 0 };
  const ortg = (100 * teamPts) / possessions;
  const drtg = (100 * oppPts) / possessions;
  const nrtg = ortg - drtg;
  const pace = totalMinutes > 0 ? (possessions / totalMinutes) * 40 : null;
  return { ortg, drtg, nrtg, pace, possessions };
}

export function buildGameFlowPoints(
  events: StatEvent[],
  homeTeamId: string,
): { period: number; clock: number | null; homeScore: number; awayScore: number }[] {
  const scoringEvents = events.filter((e) => ['2PM', '3PM', 'FTM'].includes(e.statType) && e.teamId);
  const points: ReturnType<typeof buildGameFlowPoints> = [{ period: 1, clock: null, homeScore: 0, awayScore: 0 }];
  let home = 0;
  let away = 0;
  for (const e of scoringEvents) {
    const pts = e.statType === '3PM' ? 3 : e.statType === 'FTM' ? 1 : 2;
    if (e.teamId === homeTeamId) home += pts; else away += pts;
    points.push({ period: e.period, clock: e.clockTimeSeconds, homeScore: home, awayScore: away });
  }
  return points;
}

export function detectScoringRuns(
  events: StatEvent[],
  threshold = 5,
): { teamId: string; points: number; startClock: number | null; endClock: number | null; period: number }[] {
  const scoringEvents = events.filter(
    (e) => ['2PM', '3PM', 'FTM'].includes(e.statType) && e.teamId,
  );

  const runs: ReturnType<typeof detectScoringRuns> = [];
  let currentTeam: string | null = null;
  let runPoints = 0;
  let runStart: typeof scoringEvents[0] | null = null;

  for (const e of scoringEvents) {
    const pts = e.statType === '3PM' ? 3 : e.statType === 'FTM' ? 1 : 2;
    if (e.teamId !== currentTeam) {
      if (currentTeam && runPoints >= threshold && runStart) {
        runs.push({
          teamId: currentTeam,
          points: runPoints,
          startClock: runStart.clockTimeSeconds,
          endClock: e.clockTimeSeconds,
          period: runStart.period,
        });
      }
      currentTeam = e.teamId;
      runPoints = pts;
      runStart = e;
    } else {
      runPoints += pts;
    }
  }

  if (currentTeam && runPoints >= threshold && runStart) {
    runs.push({
      teamId: currentTeam,
      points: runPoints,
      startClock: runStart.clockTimeSeconds,
      endClock: null,
      period: runStart.period,
    });
  }

  return runs;
}
