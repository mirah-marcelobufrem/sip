import type { PossessionState, StatEvent, StatType } from './entities/game.entity.js';

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

export interface PossessionChangeContext {
  /** Opponent of the team that produced the event (null if unknown). */
  opponentTeamId: string | null;
  /** 1-based index of this free throw within its sequence. */
  lastFtIndex: number;
  /** Total free throws awarded in the sequence. */
  totalFtsInSequence: number;
}

/**
 * Pure possession-change resolver implementing BR-STAT-1.1–1.4.
 * Returns the next PossessionState after `event` is recorded.
 * The alternating-possession arrow is carried through unchanged.
 */
export function resolvePossessionChange(
  event: Pick<StatEvent, 'statType' | 'teamId'>,
  current: PossessionState,
  context: PossessionChangeContext,
): PossessionState {
  const isLastFt = context.lastFtIndex >= context.totalFtsInSequence;

  switch (event.statType) {
    case '2PM':
    case '3PM':
      // Made field goal → possession switches to the opponent
      return { teamId: context.opponentTeamId, arrowTeamId: current.arrowTeamId, isPending: false };
    case 'DREB':
      // Defensive rebound → possession switches to the rebounding team
      return { teamId: event.teamId, arrowTeamId: current.arrowTeamId, isPending: false };
    case 'OREB':
      // Offensive rebound → same possession continues (BR-STAT-1.3);
      // also resolves a pending last-FT-miss state
      return { teamId: current.teamId, arrowTeamId: current.arrowTeamId, isPending: false };
    case 'TO':
      // Turnover → possession switches to the non-offending team
      return { teamId: context.opponentTeamId, arrowTeamId: current.arrowTeamId, isPending: false };
    case 'STL':
      // Steal → possession switches to the stealing team
      return { teamId: event.teamId, arrowTeamId: current.arrowTeamId, isPending: false };
    case 'FTM':
      // Last FT made → switch to opponent; non-last FT → no change
      return isLastFt
        ? { teamId: context.opponentTeamId, arrowTeamId: current.arrowTeamId, isPending: false }
        : current;
    case 'FTA':
      // Last FT missed → wait for the rebound before resolving possession
      return isLastFt ? { ...current, isPending: true } : current;
    case 'PERIOD_START':
      // Initial possession comes from the jump-ball / arrow selection (UI picks)
      return {
        teamId: event.teamId ?? current.teamId,
        arrowTeamId: current.arrowTeamId,
        isPending: false,
      };
    default:
      // 2PA/3PA (await rebound), AST, BLK, DFD, fouls, SUB_IN/OUT,
      // PERIOD_END, TIMEOUT → no possession change
      return current;
  }
}

/**
 * FIBA 3-point area test — SPEC FRAME ONLY.
 *
 * Coordinate frames (both normalized 0–1 over a 15 m × 14 m half-court):
 * - SPEC frame (this function): baseline at y=1, basket center at (0.5, 0.885).
 * - STORAGE frame (stat_events.xCourt/yCourt, classifyShotZone, frontend
 *   submissions): baseline at y=0, basket center at (0.5, 0.113).
 * The two frames are mirror images: ySpec = 1 - yStorage.
 *
 * This is the single source of the 3pt geometry (pure spec formula).
 * Anything operating on stored/submitted coordinates must go through the
 * storage-frame adapter below — never call this directly with xCourt/yCourt.
 *
 * Three-point if real distance from the basket exceeds 6.75 m, plus the
 * corner-3 straight sections (x < 0.085 or x > 0.915) at any depth.
 */
export function isThreePointArea(x: number, y: number): boolean {
  if (x < 0.085 || x > 0.915) return true;
  const dx = (x - 0.5) * 15;
  const dy = (y - 0.885) * 14;
  return Math.sqrt(dx * dx + dy * dy) > 6.75;
}

/**
 * STORAGE-frame adapter for isThreePointArea. Takes xCourt/yCourt exactly as
 * stored in stat_events (basket at (0.5, 0.113), baseline at y=0) and mirrors
 * y into the spec frame before evaluating the pure geometry.
 */
export function isThreePointAreaCourt(xCourt: number, yCourt: number): boolean {
  return isThreePointArea(xCourt, 1 - yCourt);
}

/**
 * BR-STAT-9.6 — FTs awarded for a shooting foul: 3 if the shot came from the
 * 3pt area. Inputs are STORAGE-frame xCourt/yCourt (as submitted/stored).
 */
export function getFTCountForShootingFoul(xCourt: number, yCourt: number): 2 | 3 {
  return isThreePointAreaCourt(xCourt, yCourt) ? 3 : 2;
}

/** Annotates each event with the ids of events that reference it as their linked parent. */
export function attachLinkedChildren<T extends { id: string; linkedActionId: string | null }>(
  events: T[],
): (T & { linkedChildren: string[] })[] {
  const childrenByParent = new Map<string, string[]>();
  for (const e of events) {
    if (!e.linkedActionId) continue;
    const list = childrenByParent.get(e.linkedActionId) ?? [];
    list.push(e.id);
    childrenByParent.set(e.linkedActionId, list);
  }
  return events.map((e) => ({ ...e, linkedChildren: childrenByParent.get(e.id) ?? [] }));
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

export function computePer36(box: PlayerBoxScore): Partial<PlayerBoxScore> | null {
  if (box.minSeconds < 30) return null; // insufficient sample
  const factor = 2160 / box.minSeconds; // 36 min = 2160 seconds
  return {
    pts: box.pts * factor,
    fgm: box.fgm * factor,
    fga: box.fga * factor,
    twopm: box.twopm * factor,
    twopa: box.twopa * factor,
    threepm: box.threepm * factor,
    threepa: box.threepa * factor,
    ftm: box.ftm * factor,
    fta: box.fta * factor,
    oreb: box.oreb * factor,
    dreb: box.dreb * factor,
    reb: box.reb * factor,
    ast: box.ast * factor,
    to: box.to * factor,
    stl: box.stl * factor,
    blk: box.blk * factor,
    pf: box.pf * factor,
  };
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

export function classifyMatchupResult(teamScore: number, oppScore: number): 'W' | 'L' | 'T' {
  if (teamScore > oppScore) return 'W';
  if (teamScore < oppScore) return 'L';
  return 'T';
}

export interface MatchupGameRow {
  teamScore: number;
  oppScore: number;
}

export interface MatchupSummary {
  wins: number;
  losses: number;
  avgScoreDiff: number;
  avgPts: number;
  avgOppPts: number;
}

export function computeMatchupSummary(rows: MatchupGameRow[]): MatchupSummary {
  let wins = 0;
  let losses = 0;
  let totalDiff = 0;
  let totalTeamPts = 0;
  let totalOppPts = 0;

  for (const r of rows) {
    const result = classifyMatchupResult(r.teamScore, r.oppScore);
    if (result === 'W') wins++;
    else if (result === 'L') losses++;
    totalDiff += r.teamScore - r.oppScore;
    totalTeamPts += r.teamScore;
    totalOppPts += r.oppScore;
  }

  const count = rows.length;
  return {
    wins,
    losses,
    avgScoreDiff: count > 0 ? totalDiff / count : 0,
    avgPts: count > 0 ? totalTeamPts / count : 0,
    avgOppPts: count > 0 ? totalOppPts / count : 0,
  };
}
