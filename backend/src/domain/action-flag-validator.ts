import type { PossessionState, StatEvent, StatType } from './entities/game.entity.js';

/**
 * FIBA BR-STAT rule validators (Sprint S06 / item I-01).
 *
 * Every rule is a PURE function: it inspects a candidate event against the
 * current game context and DESCRIBES what is wrong (ValidationResult). Rules
 * never mutate state and never insert events — where the FIBA manual mandates
 * an auto-insert/auto-replace (e.g. TO on an offensive foul), the rule returns
 * flagKind 'AutoCorrect' and the S08 capture engine performs the correction.
 *
 * Conventions:
 * - ctx.recentEvents is ordered oldest → newest (most recent LAST) and does
 *   NOT include the candidate event itself.
 * - Several FIBA triggers depend on event subtypes that only arrive in S07
 *   (PF(Shooting)/PF(Offensive), GoalTending, ShotClockViolation, ball-OOB).
 *   Those rules are implemented against the best available signal in today's
 *   event model (possession state, link_role chains from S05, clock equality)
 *   and each approximation is documented inline.
 */

export type FlagKind =
  /** A block/score implies a field-goal attempt that was never recorded. */
  | 'MissingFGA'
  /** Non-blocking: the operator must review the call. */
  | 'User'
  /** The capture engine (S08) can fix this deterministically. */
  | 'AutoCorrect';

export interface StatContext {
  /** Last events of the game, oldest → newest, excluding the candidate. */
  recentEvents: StatEvent[];
  /** Current on-court lineup (both teams). */
  onCourtPlayerIds: string[];
  playerFoulCounts: Record<string, number>;
  currentPossession: PossessionState;
  period: number;
  clockTimeSeconds: number;
}

export interface ValidationResult {
  isValid: boolean;
  flagKind?: FlagKind;
  message?: string;
  linkedEventIds?: string[];
}

export type StatRule = (event: StatEvent, ctx: StatContext) => ValidationResult;

const VALID: ValidationResult = { isValid: true };

const SHOT_ATTEMPT_TYPES: StatType[] = ['2PA', '3PA'];
const SHOT_MADE_TYPES: StatType[] = ['2PM', '3PM'];
const REBOUND_TYPES: StatType[] = ['OREB', 'DREB'];
const FT_TYPES: StatType[] = ['FTM', 'FTA'];
const FOUL_TYPES: StatType[] = ['PF', 'TF', 'FF'];
const DEAD_BALL_TYPES: StatType[] = ['TIMEOUT', 'PERIOD_END', 'PERIOD_START'];

function lastEvent(ctx: StatContext): StatEvent | undefined {
  return ctx.recentEvents[ctx.recentEvents.length - 1];
}

/**
 * BR-STAT-2.2 — no FGA is charged when a player is fouled in the act of
 * shooting and the shot is missed.
 *
 * S07 limitation: PF(Shooting) does not exist yet. Approximation: the
 * candidate is a missed attempt (2PA/3PA) recorded immediately after a PF by
 * the OPPOSING team, and the shooter is confirmed as the fouled player either
 * by a DFD linked to that foul (link_role 'foul_drawn', S05) or by an equal
 * clock time on foul and shot.
 */
export const ruleBRSTAT_2_2: StatRule = (event, ctx) => {
  if (!SHOT_ATTEMPT_TYPES.includes(event.statType)) return VALID;

  // Skip DFD companions: the S05 flow records PF → DFD(foul_drawn) → shot
  const prev = [...ctx.recentEvents].reverse().find((e) => e.statType !== 'DFD');
  if (!prev || prev.statType !== 'PF' || prev.isBenchFoul) return VALID;
  if (!prev.teamId || prev.teamId === event.teamId) return VALID; // not a defensive foul on the shooter's team

  const foulDrawnByShooter = ctx.recentEvents.some(
    (e) =>
      e.statType === 'DFD' &&
      e.linkedActionId === prev.id &&
      e.playerId === event.playerId,
  );
  const sameClock =
    prev.clockTimeSeconds !== null &&
    event.clockTimeSeconds !== null &&
    prev.clockTimeSeconds === event.clockTimeSeconds;

  if (!foulDrawnByShooter && !sameClock) return VALID;

  return {
    isValid: false,
    flagKind: 'AutoCorrect',
    message:
      'BR-STAT-2.2: a player fouled in the act of shooting whose shot misses is not charged a field-goal attempt — remove the missed-shot event (free throws replace it)',
    linkedEventIds: [prev.id],
  };
};

/**
 * BR-STAT-2.4 — a controlled tip-in/putback earns the SAME player both the
 * OREB and the FGA/FGM. The pattern OREB(X) → FGM(X) is correct; an OREB by
 * one player immediately followed (same clock) by a putback FGM credited to a
 * DIFFERENT player indicates a mis-attributed tip and needs operator review.
 */
export const ruleBRSTAT_2_4: StatRule = (event, ctx) => {
  if (!SHOT_MADE_TYPES.includes(event.statType)) return VALID;

  const prev = lastEvent(ctx);
  if (!prev || prev.statType !== 'OREB' || prev.isTeamRebound) return VALID;
  if (!prev.playerId || prev.playerId === event.playerId) return VALID;

  const sameClock =
    prev.clockTimeSeconds !== null &&
    event.clockTimeSeconds !== null &&
    prev.clockTimeSeconds === event.clockTimeSeconds;
  if (!sameClock) return VALID; // a later shot after a kick-out pass is fine

  return {
    isValid: false,
    flagKind: 'User',
    message:
      'BR-STAT-2.4: a controlled tip/putback credits the offensive rebound and the field goal to the same player — verify the attribution',
    linkedEventIds: [prev.id],
  };
};

/**
 * BR-STAT-2.5 — a block always implies a field-goal attempt by the opponent.
 * Valid when the candidate BLK is linked to a shot attempt (linkedActionId)
 * or immediately follows one; otherwise the FGA is missing.
 */
export const ruleBRSTAT_2_5: StatRule = (event, ctx) => {
  if (event.statType !== 'BLK') return VALID;

  if (event.linkedActionId) {
    const linked = ctx.recentEvents.find((e) => e.id === event.linkedActionId);
    if (linked && SHOT_ATTEMPT_TYPES.includes(linked.statType)) return VALID;
  }

  const prev = lastEvent(ctx);
  if (prev && SHOT_ATTEMPT_TYPES.includes(prev.statType)) return VALID;

  return {
    isValid: false,
    flagKind: 'MissingFGA',
    message:
      'BR-STAT-2.5: a block always generates a field-goal attempt for the shooter — record the missed shot the block belongs to',
  };
};

/**
 * BR-STAT-2.7 — own basket: a field goal scored into a team's own basket is
 * credited to the court captain of the OFFENSIVE team. Trigger: a made shot
 * by a team that is NOT in possession. The captain is not modelled yet, so
 * the auto-correct describes the reassignment for the capture engine.
 */
export const ruleBRSTAT_2_7: StatRule = (event, ctx) => {
  if (!SHOT_MADE_TYPES.includes(event.statType)) return VALID;

  const possessionTeamId = ctx.currentPossession.teamId;
  if (!possessionTeamId || !event.teamId || event.teamId === possessionTeamId) return VALID;

  return {
    isValid: false,
    flagKind: 'AutoCorrect',
    message:
      'BR-STAT-2.7: own basket — the field goal is credited to the court captain of the offensive team, not to the defending player who scored it',
  };
};

/**
 * BR-STAT-2.8 — goaltending.
 *
 * S07 limitation: there is no GoalTending action type yet. Best available
 * signal today: a BLK recorded by a player of the SAME team as the shot
 * attempt is offensive basket interference — no block and no FGA stand, and a
 * TO(OffensiveGoaltending) replaces them. Defensive goaltending (FGM awarded
 * despite the miss) cannot be detected until the GoalTending type lands.
 */
export const ruleBRSTAT_2_8: StatRule = (event, ctx) => {
  if (event.statType !== 'BLK') return VALID;

  const linked = event.linkedActionId
    ? ctx.recentEvents.find((e) => e.id === event.linkedActionId)
    : lastEvent(ctx);
  if (!linked || !SHOT_ATTEMPT_TYPES.includes(linked.statType)) return VALID;
  if (!linked.teamId || !event.teamId || linked.teamId !== event.teamId) return VALID;

  return {
    isValid: false,
    flagKind: 'AutoCorrect',
    message:
      'BR-STAT-2.8: offensive goaltending — no block and no field-goal attempt are charged; replace with a turnover on the interfering player',
    linkedEventIds: [linked.id],
  };
};

/**
 * BR-STAT-3.7 — a technical-foul free throw taken between periods (clock at
 * 00:00 after the period ended) is credited to the FOLLOWING period.
 */
export const ruleBRSTAT_3_7: StatRule = (event, ctx) => {
  if (!FT_TYPES.includes(event.statType)) return VALID;
  if (event.clockTimeSeconds !== 0) return VALID;

  const periodEnded = ctx.recentEvents.some(
    (e) => e.statType === 'PERIOD_END' && e.period === event.period,
  );
  if (!periodEnded) return VALID;

  return {
    isValid: false,
    flagKind: 'AutoCorrect',
    message: `BR-STAT-3.7: a free throw taken after the period ended belongs to period ${event.period + 1} — adjust the event's period`,
  };
};

/**
 * BR-STAT-4.3 — team rebound integrity: a team rebound is never credited to
 * an individual (playerId must be null), and a rebound with no player must be
 * flagged as a team rebound.
 *
 * S07 limitation: the real trigger (ball out-of-bounds before recovery) needs
 * the ball-OOB event type; until then this rule enforces the flag/player
 * consistency of the is_team_rebound column added in I-05.
 */
export const ruleBRSTAT_4_3: StatRule = (event) => {
  if (!REBOUND_TYPES.includes(event.statType)) return VALID;

  if (event.isTeamRebound && event.playerId !== null) {
    return {
      isValid: false,
      flagKind: 'AutoCorrect',
      message: 'BR-STAT-4.3: a team rebound must not carry a playerId — clear the player attribution',
    };
  }
  if (!event.isTeamRebound && event.playerId === null) {
    return {
      isValid: false,
      flagKind: 'User',
      message: 'BR-STAT-4.3: a rebound without a player must be marked as a team rebound',
    };
  }
  return VALID;
};

/**
 * BR-STAT-4.4 — no-rebound cases (also I-05.4): no rebound exists after a
 * missed free throw that is NOT the last of its sequence.
 *
 * S07 limitation: the awarded-FT count per foul is not modelled yet
 * (F-06 guided workflow). Approximation: free throws of one sequence share a
 * linkedActionId to their foul (link_role 'ft_for_foul', S05). The expected
 * sequence length is 3 when the foul was drawn on a 3PA (most recent attempt
 * before the foul), otherwise 2. If fewer FTs than expected have been taken
 * when the rebound is recorded, the preceding FTA was not the last one.
 * The second trigger (shot-clock violation before recovery) awaits the S07
 * ShotClockViolation type.
 */
export const ruleBRSTAT_4_4: StatRule = (event, ctx) => {
  if (!REBOUND_TYPES.includes(event.statType)) return VALID;

  const prev = lastEvent(ctx);
  if (!prev || prev.statType !== 'FTA') return VALID; // only missed FTs leave a live rebound

  const foulId = prev.linkedActionId;
  if (!foulId) return VALID; // unlinked FT: sequence length unknowable, accept

  const ftsTaken = ctx.recentEvents.filter(
    (e) => FT_TYPES.includes(e.statType) && e.linkedActionId === foulId,
  ).length;

  const foulIndex = ctx.recentEvents.findIndex((e) => e.id === foulId);
  const attemptBeforeFoul = [...ctx.recentEvents.slice(0, Math.max(foulIndex, 0))]
    .reverse()
    .find((e) => SHOT_ATTEMPT_TYPES.includes(e.statType));
  const expectedFts = attemptBeforeFoul?.statType === '3PA' ? 3 : 2;

  if (ftsTaken >= expectedFts) return VALID; // last FT of the sequence — rebound is live

  return {
    isValid: false,
    flagKind: 'User',
    message:
      'BR-STAT-4.4: no rebound is credited after a missed free throw that is not the last of its sequence — remove the rebound',
    linkedEventIds: [prev.id],
  };
};

/**
 * BR-STAT-4.5 — mini-possession: a player who taps the rebound and
 * immediately loses it (TO at the same clock) is not credited the OREB; it
 * becomes a team DREB for the opponents.
 */
export const ruleBRSTAT_4_5: StatRule = (event, ctx) => {
  if (event.statType !== 'TO') return VALID;

  const prev = lastEvent(ctx);
  if (!prev || prev.statType !== 'OREB' || prev.isTeamRebound) return VALID;
  if (!prev.playerId || prev.playerId !== event.playerId) return VALID;

  const sameClock =
    prev.clockTimeSeconds !== null &&
    event.clockTimeSeconds !== null &&
    prev.clockTimeSeconds === event.clockTimeSeconds;
  if (!sameClock) return VALID; // controlled rebound followed by a later turnover is fine

  return {
    isValid: false,
    flagKind: 'AutoCorrect',
    message:
      'BR-STAT-4.5: mini-possession — replace the offensive rebound with a team defensive rebound for the opposing team',
    linkedEventIds: [prev.id],
  };
};

/**
 * BR-STAT-5.3 — an offensive foul always produces a turnover on the fouling
 * player (auto-insert TO, link_role 'to_after_offensive_foul').
 *
 * S07 limitation: PF(Offensive) does not exist yet. Approximation: a personal
 * foul committed by a player of the team currently IN POSSESSION is an
 * offensive foul.
 */
export const ruleBRSTAT_5_3: StatRule = (event, ctx) => {
  if (event.statType !== 'PF' || event.isBenchFoul) return VALID;

  const possessionTeamId = ctx.currentPossession.teamId;
  if (!possessionTeamId || !event.teamId || event.teamId !== possessionTeamId) return VALID;

  return {
    isValid: false,
    flagKind: 'AutoCorrect',
    message:
      "BR-STAT-5.3: offensive foul — auto-insert a turnover on the fouling player (link_role 'to_after_offensive_foul')",
    linkedEventIds: [event.id],
  };
};

/**
 * BR-STAT-6.3 — assist ambiguity: when the receiver dribbled before scoring,
 * the assist call needs operator review (non-blocking).
 *
 * S07 limitation: dribbles are not modelled. Approximation: an assist whose
 * linked made shot happened 2+ seconds after the pass (clock delta) implies
 * the receiver put the ball on the floor first.
 */
export const ruleBRSTAT_6_3: StatRule = (event, ctx) => {
  if (event.statType !== 'AST') return VALID;

  const made = event.linkedActionId
    ? ctx.recentEvents.find((e) => e.id === event.linkedActionId)
    : ctx.recentEvents.filter((e) => SHOT_MADE_TYPES.includes(e.statType)).pop();
  if (!made || !SHOT_MADE_TYPES.includes(made.statType)) return VALID;
  if (made.clockTimeSeconds === null || event.clockTimeSeconds === null) return VALID;

  const elapsed = Math.abs(event.clockTimeSeconds - made.clockTimeSeconds);
  if (elapsed < 2) return VALID;

  return {
    isValid: true, // non-blocking — the operator reviews the call
    flagKind: 'User',
    message:
      'BR-STAT-6.3: the receiver appears to have dribbled before shooting — review whether the pass still qualifies as an assist',
    linkedEventIds: [made.id],
  };
};

/**
 * BR-STAT-7.3 — no steal is credited when the ball becomes dead (out of
 * bounds) without a held-ball situation.
 *
 * S07 limitation: there is no ball-OOB event type. Approximation: a STL
 * recorded immediately after any dead-ball event (TIMEOUT / PERIOD_END /
 * PERIOD_START) cannot be a live-ball steal.
 */
export const ruleBRSTAT_7_3: StatRule = (event, ctx) => {
  if (event.statType !== 'STL') return VALID;

  const prev = lastEvent(ctx);
  if (!prev || !DEAD_BALL_TYPES.includes(prev.statType)) return VALID;

  return {
    isValid: false,
    flagKind: 'User',
    message: 'BR-STAT-7.3: a steal cannot be credited from a dead ball — remove the steal',
    linkedEventIds: [prev.id],
  };
};

/**
 * BR-STAT-8.3 — a block cannot occur after the ball has touched the rim.
 *
 * S07 limitation: rim contact is not modelled. Approximation: a BLK recorded
 * after the missed shot was already resolved by a rebound means the ball had
 * hit the rim (or been recovered) before the alleged block.
 */
export const ruleBRSTAT_8_3: StatRule = (event, ctx) => {
  if (event.statType !== 'BLK') return VALID;

  const prev = lastEvent(ctx);
  if (!prev || !REBOUND_TYPES.includes(prev.statType)) return VALID;

  return {
    isValid: false,
    flagKind: 'User',
    message: 'BR-STAT-8.3: a block cannot occur after rim contact — the shot was already resolved by a rebound',
    linkedEventIds: [prev.id],
  };
};

/**
 * BR-STAT-9.2 — coach/bench fouls never count as team fouls. The counter
 * exclusion itself lives in getTeamFoulCountForPeriod (I-06); this rule
 * enforces that a foul flagged as a bench foul is not simultaneously
 * attributed to an on-court player.
 */
export const ruleBRSTAT_9_2: StatRule = (event, ctx) => {
  if (!FOUL_TYPES.includes(event.statType)) return VALID;
  if (!event.isBenchFoul) return VALID;
  if (!event.playerId || !ctx.onCourtPlayerIds.includes(event.playerId)) return VALID;

  return {
    isValid: false,
    flagKind: 'User',
    message:
      'BR-STAT-9.2: a bench/coach foul is attributed to an on-court player — either clear the bench flag or reassign the foul',
  };
};

const ALL_RULES: StatRule[] = [
  ruleBRSTAT_2_2,
  ruleBRSTAT_2_4,
  ruleBRSTAT_2_5,
  ruleBRSTAT_2_7,
  ruleBRSTAT_2_8,
  ruleBRSTAT_3_7,
  ruleBRSTAT_4_3,
  ruleBRSTAT_4_4,
  ruleBRSTAT_4_5,
  ruleBRSTAT_5_3,
  ruleBRSTAT_6_3,
  ruleBRSTAT_7_3,
  ruleBRSTAT_8_3,
  ruleBRSTAT_9_2,
];

/**
 * Runs every BR-STAT rule against the candidate event and returns all
 * findings: hard violations (isValid: false) plus non-blocking review flags
 * (isValid: true with a flagKind, e.g. BR-STAT-6.3). Clean passes are omitted.
 */
export function validateAction(event: StatEvent, ctx: StatContext): ValidationResult[] {
  return ALL_RULES
    .map((rule) => rule(event, ctx))
    .filter((r) => !r.isValid || r.flagKind !== undefined);
}
