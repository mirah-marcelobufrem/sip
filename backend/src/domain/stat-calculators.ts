import type {
  LineupSnapshot,
  PossessionSequence,
  PossessionState,
  StatEvent,
  StatType,
} from './entities/game.entity.js';

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
      // BR-STAT-4.3 — team rebounds never count toward an individual stat line
      case 'OREB': if (!e.isTeamRebound) box.oreb++; break;
      case 'DREB': if (!e.isTeamRebound) box.dreb++; break;
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

export interface TeamReboundTotals {
  teamOReb: number;
  teamDReb: number;
}

/**
 * BR-STAT-4.3 — team-level rebound aggregate. Counts only OREB/DREB events
 * flagged isTeamRebound for the given team; player rebounds are excluded
 * (they live on the individual box scores).
 */
export function aggregateTeamRebounds(events: StatEvent[], teamId: string): TeamReboundTotals {
  let teamOReb = 0;
  let teamDReb = 0;
  for (const e of events) {
    if (!e.isTeamRebound || e.teamId !== teamId) continue;
    if (e.statType === 'OREB') teamOReb++;
    else if (e.statType === 'DREB') teamDReb++;
  }
  return { teamOReb, teamDReb };
}

/**
 * FIBA BR-MET-1.1–1.5 — minutes-played display rounding.
 *
 * - Fractional seconds (0.1–0.9 s) are first rounded UP to a whole second.
 * - < 30 s into a minute → round DOWN; ≥ 30 s → round UP.
 * - EXCEPTION (BR-MET-1.5): within the final minute below the game maximum
 *   (e.g. 39:59 of a 40:00 game) → always round DOWN, so a player never
 *   shows the full game length unless they played every second of it.
 *
 * Returns a whole-minute string ("0", "1", "39", "40"). 0 seconds returns
 * "0" — "DNP" is decided by the caller via isDNP(), not by this formatter.
 */
export function formatMinutesPlayed(seconds: number, gameMaxSeconds: number): string {
  if (seconds <= 0) return '0';

  // BR-MET-1.4 — sub-second remainders round up to a full second first
  const wholeSeconds = Math.min(Math.ceil(seconds), gameMaxSeconds);

  const floorMinutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;

  // BR-MET-1.5 — final minute below the game max always rounds down
  const maxMinutes = Math.floor(gameMaxSeconds / 60);
  if (wholeSeconds < gameMaxSeconds && floorMinutes === maxMinutes - 1) {
    return String(floorMinutes);
  }

  return String(remainder >= 30 ? floorMinutes + 1 : floorMinutes);
}

/**
 * BR-MET-1.3 — DNP detection: a player who has no SUB_IN event and was not a
 * starter never entered the game.
 *
 * Today's model has no isStarter field on the player entity; starters are
 * recorded via the initial lineup snapshot. Callers therefore pass the
 * starter ids (period-1 initial lineup playerIds) explicitly.
 */
export function isDNP(events: StatEvent[], playerId: string, starterPlayerIds: string[] = []): boolean {
  if (starterPlayerIds.includes(playerId)) return false;
  return !events.some((e) => e.statType === 'SUB_IN' && e.playerId === playerId);
}

const SCORING_POINTS: Partial<Record<StatType, number>> = { '2PM': 2, '3PM': 3, FTM: 1 };

export interface PlayerStintTotals {
  minSeconds: number;
  plusMinus: number;
}

/**
 * N-01 — stint engine v1: minutes played and per-player plus/minus derived
 * from lineup snapshots and substitution events.
 *
 * APPROXIMATION (documented, v1): live events carry no clock today, so a
 * substitution's position WITHIN a period is estimated proportionally by its
 * event index (a sub at event k of N marks k/N of the period elapsed). Periods
 * with no events contribute nothing. When clock capture lands, this upgrades
 * to exact clock-delta stints — the call sites stay unchanged.
 *
 * Rules:
 * - A team's on-court set at the start of period 1 is its initial lineup
 *   snapshot (the earliest period-1 snapshot not referenced by any SUB event).
 *   Lineups carry across period boundaries.
 * - Each SUB_IN/SUB_OUT event pointing at a NEW lineupSnapshotId is a
 *   boundary; consecutive SUB events sharing one snapshot form one boundary.
 * - A team with no snapshots accrues nothing (no data is invented).
 * - plusMinus: points scored by the player's team minus points by any other
 *   team while the player is on court (2PM=2, 3PM=3, FTM=1).
 * - Periods beyond regulation (future OT) also use periodDurationMinutes.
 */
export function computePlayerStints(
  events: StatEvent[],
  snapshots: LineupSnapshot[],
  game: { numPeriods: number; periodDurationMinutes: number },
): Map<string, PlayerStintTotals> {
  const totals = new Map<string, PlayerStintTotals>();
  const periodSeconds = game.periodDurationMinutes * 60;

  const credit = (playerIds: string[] | null, seconds: number, delta: number): void => {
    if (!playerIds || (seconds <= 0 && delta === 0)) return;
    for (const pid of playerIds) {
      const t = totals.get(pid) ?? { minSeconds: 0, plusMinus: 0 };
      t.minSeconds += seconds;
      t.plusMinus += delta;
      totals.set(pid, t);
    }
  };

  // Events grouped by period, preserving repository order within each period.
  const byPeriod = new Map<number, StatEvent[]>();
  for (const e of events) {
    const list = byPeriod.get(e.period) ?? [];
    list.push(e);
    byPeriod.set(e.period, list);
  }
  const periods = [...byPeriod.keys()].sort((a, b) => a - b);

  const snapshotById = new Map(snapshots.map((s) => [s.id, s]));
  const subSnapshotIds = new Set(
    events
      .filter((e) => (e.statType === 'SUB_IN' || e.statType === 'SUB_OUT') && e.lineupSnapshotId)
      .map((e) => e.lineupSnapshotId as string),
  );

  const teamIds = [...new Set(snapshots.map((s) => s.teamId))];
  for (const teamId of teamIds) {
    const initial = snapshots.find(
      (s) => s.teamId === teamId && s.period === 1 && !subSnapshotIds.has(s.id),
    );
    let currentSet: string[] | null = initial?.playerIds ?? null;
    let currentSnapshotId: string | null = initial?.id ?? null;

    for (const period of periods) {
      const periodEvents = byPeriod.get(period)!;
      const n = periodEvents.length;
      if (n === 0) continue;

      let segStartFrac = 0;
      let segDelta = 0;

      for (let i = 0; i < n; i++) {
        const e = periodEvents[i]!;
        const isBoundary =
          (e.statType === 'SUB_IN' || e.statType === 'SUB_OUT') &&
          e.teamId === teamId &&
          e.lineupSnapshotId !== null &&
          e.lineupSnapshotId !== currentSnapshotId &&
          snapshotById.has(e.lineupSnapshotId);

        if (isBoundary) {
          credit(currentSet, (i / n - segStartFrac) * periodSeconds, segDelta);
          const next = snapshotById.get(e.lineupSnapshotId as string)!;
          currentSet = next.playerIds;
          currentSnapshotId = next.id;
          segStartFrac = i / n;
          segDelta = 0;
        }

        const pts = SCORING_POINTS[e.statType];
        if (pts && e.teamId) {
          segDelta += e.teamId === teamId ? pts : -pts;
        }
      }

      credit(currentSet, (1 - segStartFrac) * periodSeconds, segDelta);
    }
  }

  return totals;
}

/** FIBA: a team enters the bonus on its 5th team foul of the period. */
export const FOUL_BONUS_THRESHOLD = 5;

/**
 * BR-STAT-9.2/9.3 — team fouls for one period: PF/TF/FF events committed by
 * the team in that period, excluding coach/bench fouls (isBenchFoul).
 * Events arrive pre-filtered for soft deletes (repository contract).
 */
export function getTeamFoulCountForPeriod(events: StatEvent[], teamId: string, period: number): number {
  return events.filter(
    (e) =>
      (e.statType === 'PF' || e.statType === 'TF' || e.statType === 'FF') &&
      e.teamId === teamId &&
      e.period === period &&
      !e.isBenchFoul,
  ).length;
}

export function isTeamInBonus(events: StatEvent[], teamId: string, period: number): boolean {
  return getTeamFoulCountForPeriod(events, teamId, period) >= FOUL_BONUS_THRESHOLD;
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

export interface FourFactors {
  efgPct: number | null;
  tovPct: number | null;
  orebPct: number | null;
  ftRate: number | null;
}

export interface FourFactorsTotals {
  fgm: number;
  threePm: number;
  fga: number;
  to: number;
  fta: number;
  oreb: number;
  oppDreb: number;
}

/**
 * N-03 — Dean Oliver's Four Factors at team level.
 * eFG% = (FGM + 0.5·3PM) / FGA
 * TOV% = TO / (FGA + 0.44·FTA + TO)
 * ORB% = ORB / (ORB + opponent DRB)   (team rebounds included on both sides)
 * FTr  = FTA / FGA
 * Inputs follow the repo-wide convention: fga/fta are TRUE attempts
 * (makes + misses). Returns null for any zero denominator; raw ratios
 * (0..1), no rounding — the UI formats.
 */
export function computeFourFactors(totals: FourFactorsTotals): FourFactors {
  const { fgm, threePm, fga, to, fta, oreb, oppDreb } = totals;
  const tovDenom = fga + 0.44 * fta + to;
  const orebDenom = oreb + oppDreb;
  return {
    efgPct: fga > 0 ? (fgm + 0.5 * threePm) / fga : null,
    tovPct: tovDenom > 0 ? to / tovDenom : null,
    orebPct: orebDenom > 0 ? oreb / orebDenom : null,
    ftRate: fga > 0 ? fta / fga : null,
  };
}

/**
 * N-04 — points in the paint: 2PM whose stored STORAGE-frame coordinates
 * classify into the restricted area or the key. Shots without coordinates
 * never count; 3PM can never be a paint shot.
 */
export function computePIP(events: StatEvent[], teamId: string): number {
  let pts = 0;
  for (const e of events) {
    if (e.statType !== '2PM' || e.teamId !== teamId) continue;
    if (e.xCourt === null || e.yCourt === null) continue;
    const zone = classifyShotZone(e.xCourt, e.yCourt);
    if (zone === 'restricted_area' || zone === 'paint') pts += 2;
  }
  return pts;
}

/**
 * Points scored inside a possession-sequence window. A sequence covers the
 * event interval (startAction, endAction] — start exclusive, end INCLUSIVE,
 * so the made shot that closes a possession counts toward it. Null bounds
 * extend to the start/end of the game's event stream. Event array order is
 * authoritative (repository ordering contract).
 */
function sumSequencePoints(
  events: StatEvent[],
  posById: Map<string, number>,
  seq: PossessionSequence,
): number {
  const start = seq.startActionId !== null ? (posById.get(seq.startActionId) ?? -1) : -1;
  const end = seq.endActionId !== null ? (posById.get(seq.endActionId) ?? events.length - 1) : events.length - 1;
  let pts = 0;
  for (let i = start + 1; i <= end; i++) {
    const e = events[i];
    if (!e || e.teamId !== seq.teamId) continue;
    pts += SCORING_POINTS[e.statType] ?? 0;
  }
  return pts;
}

function eventPositionIndex(events: StatEvent[]): Map<string, number> {
  return new Map(events.map((e, i) => [e.id, i]));
}

/**
 * N-04 — points off turnovers (FIBA MET-POT): points scored in possessions
 * gained via an opponent turnover (TO by the other team / STL by this team),
 * including offensive-rebound continuation sequences of the same possession.
 * Fouls never start sequences in this model, so the FIBA "defensive foul
 * does not qualify" exclusion holds by construction.
 *
 * KNOWN CARRY-OVER: free-throw sequence position is hardcoded (every FTM
 * currently closes a possession), so FT-trip possessions are slightly
 * over-counted until F-06 lands. Documented, not fixed here.
 */
export function computePOT(
  events: StatEvent[],
  sequences: PossessionSequence[],
  teamId: string,
): number {
  const posById = eventPositionIndex(events);
  const eventById = new Map(events.map((e) => [e.id, e]));
  let pts = 0;
  let inChain = false;
  for (const seq of sequences) {
    if (seq.teamId !== teamId) {
      inChain = false;
      continue;
    }
    const startEvent = seq.startActionId !== null ? eventById.get(seq.startActionId) : undefined;
    const qualifies =
      startEvent !== undefined &&
      ((startEvent.statType === 'TO' && startEvent.teamId !== teamId) ||
        (startEvent.statType === 'STL' && startEvent.teamId === teamId));

    if (qualifies) inChain = true;
    else if (!(seq.isOffensiveReboundContinuation && inChain)) inChain = false;

    if (inChain) pts += sumSequencePoints(events, posById, seq);
  }
  return pts;
}

/**
 * N-04 — second-chance points: points scored in offensive-rebound
 * continuation sequences (the possession segment after an OREB).
 */
export function compute2CP(
  events: StatEvent[],
  sequences: PossessionSequence[],
  teamId: string,
): number {
  const posById = eventPositionIndex(events);
  let pts = 0;
  for (const seq of sequences) {
    if (seq.teamId !== teamId || !seq.isOffensiveReboundContinuation) continue;
    pts += sumSequencePoints(events, posById, seq);
  }
  return pts;
}

/**
 * N-04 — points per possession. Possessions = the team's sequences excluding
 * OREB continuations (a continuation is the same possession). Null when the
 * team has no recorded possessions (e.g. games vs unmanaged opponents where
 * possession bookkeeping is best-effort).
 */
export function computePPP(
  events: StatEvent[],
  sequences: PossessionSequence[],
  teamId: string,
): number | null {
  const posById = eventPositionIndex(events);
  let pts = 0;
  let possessions = 0;
  for (const seq of sequences) {
    if (seq.teamId !== teamId) continue;
    if (!seq.isOffensiveReboundContinuation) possessions++;
    pts += sumSequencePoints(events, posById, seq);
  }
  return possessions > 0 ? pts / possessions : null;
}

/**
 * N-04 — bench points: points by the team's players who were not in the
 * starting five. Team-level events (playerId null) never count.
 */
export function computeBenchPoints(
  events: StatEvent[],
  teamId: string,
  starterPlayerIds: string[],
): number {
  let pts = 0;
  for (const e of events) {
    if (e.teamId !== teamId || !e.playerId || starterPlayerIds.includes(e.playerId)) continue;
    pts += SCORING_POINTS[e.statType] ?? 0;
  }
  return pts;
}

/**
 * N-13 — normalize counting stats to a per-N-minutes basis. The base should
 * follow the game format (FIBA 40-minute regulation → 40); 36 is kept as the
 * NBA-convention option. Returns null below 30 seconds played.
 */
export function computePerMinutes(
  box: PlayerBoxScore,
  baseMinutes: number,
): Partial<PlayerBoxScore> | null {
  if (box.minSeconds < 30) return null; // insufficient sample
  const factor = (baseMinutes * 60) / box.minSeconds;
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

/** Legacy NBA-convention wrapper over computePerMinutes (kept for existing callers). */
export function computePer36(box: PlayerBoxScore): Partial<PlayerBoxScore> | null {
  return computePerMinutes(box, 36);
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
