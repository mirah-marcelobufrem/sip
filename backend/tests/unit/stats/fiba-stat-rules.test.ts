import {
  validateAction,
  type StatContext,
  type ValidationResult,
} from '../../../src/domain/action-flag-validator.js';
import type { StatEvent } from '../../../src/domain/entities/game.entity.js';

const GAME_ID = '00000000-0000-0000-0000-000000000001';
const TEAM_A = '00000000-0000-0000-0000-00000000000a'; // offense in most scenarios
const TEAM_B = '00000000-0000-0000-0000-00000000000b';
const P1 = '00000000-0000-0000-0000-000000000101'; // Team A player
const P2 = '00000000-0000-0000-0000-000000000102'; // Team A player
const P3 = '00000000-0000-0000-0000-000000000201'; // Team B player
const E_FOUL = '00000000-0000-0000-0000-000000000301';
const E_SHOT = '00000000-0000-0000-0000-000000000302';
const E_OREB = '00000000-0000-0000-0000-000000000303';
const E_FT1 = '00000000-0000-0000-0000-000000000304';
const E_FT2 = '00000000-0000-0000-0000-000000000305';
const E_MISC = '00000000-0000-0000-0000-000000000306';
const E_CAND = '00000000-0000-0000-0000-000000000399';

let idCounter = 0;
function makeEvent(overrides: Partial<StatEvent> = {}): StatEvent {
  idCounter += 1;
  return {
    id: `00000000-0000-0000-0000-0000000004${String(idCounter).padStart(2, '0')}`,
    gameId: GAME_ID,
    period: 1,
    clockTimeSeconds: 300,
    playerId: P1,
    teamId: TEAM_A,
    statType: '2PM',
    value: 1,
    xCourt: null,
    yCourt: null,
    lineupSnapshotId: null,
    seq: null,
    linkedActionId: null,
    linkRole: null,
    waveSubGroupId: null,
    isTeamRebound: false,
    isBenchFoul: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeCtx(overrides: Partial<StatContext> = {}): StatContext {
  return {
    recentEvents: [],
    onCourtPlayerIds: [P1, P2, P3],
    playerFoulCounts: {},
    currentPossession: { teamId: null, arrowTeamId: null, isPending: false },
    period: 1,
    clockTimeSeconds: 300,
    ...overrides,
  };
}

function findFlag(results: ValidationResult[], fragment: string): ValidationResult | undefined {
  return results.find((r) => r.message?.includes(fragment));
}

describe('STAT-2 — field goals', () => {
  it('BR-STAT-2.2-A: shooting foul on missed shot → no FGA (auto-correct removes the attempt)', () => {
    const foul = makeEvent({ id: E_FOUL, statType: 'PF', playerId: P3, teamId: TEAM_B, clockTimeSeconds: 300 });
    const dfd = makeEvent({ statType: 'DFD', playerId: P1, teamId: TEAM_A, linkedActionId: E_FOUL, linkRole: 'foul_drawn' });
    const miss = makeEvent({ id: E_CAND, statType: '2PA', playerId: P1, teamId: TEAM_A, clockTimeSeconds: 300 });

    const results = validateAction(miss, makeCtx({ recentEvents: [foul, dfd] }));

    const flag = findFlag(results, 'BR-STAT-2.2');
    expect(flag).toBeDefined();
    expect(flag!.isValid).toBe(false);
    expect(flag!.flagKind).toBe('AutoCorrect');
    expect(flag!.linkedEventIds).toEqual([E_FOUL]);
  });

  it('BR-STAT-2.2-B: missed shot with no preceding foul → no flag', () => {
    const miss = makeEvent({ id: E_CAND, statType: '2PA', playerId: P1, teamId: TEAM_A });
    expect(validateAction(miss, makeCtx())).toEqual([]);
  });

  it('BR-STAT-2.4: tip-in OREB and putback credited to different players → review flag', () => {
    const oreb = makeEvent({ id: E_OREB, statType: 'OREB', playerId: P1, teamId: TEAM_A, clockTimeSeconds: 250 });
    const putback = makeEvent({ id: E_CAND, statType: '2PM', playerId: P2, teamId: TEAM_A, clockTimeSeconds: 250 });

    const results = validateAction(putback, makeCtx({ recentEvents: [oreb] }));

    const flag = findFlag(results, 'BR-STAT-2.4');
    expect(flag).toBeDefined();
    expect(flag!.flagKind).toBe('User');
    expect(flag!.linkedEventIds).toEqual([E_OREB]);
  });

  it('BR-STAT-2.4: controlled tip — OREB and putback FGM by the SAME player → valid', () => {
    const oreb = makeEvent({ id: E_OREB, statType: 'OREB', playerId: P1, teamId: TEAM_A, clockTimeSeconds: 250 });
    const putback = makeEvent({ id: E_CAND, statType: '2PM', playerId: P1, teamId: TEAM_A, clockTimeSeconds: 250 });

    expect(validateAction(putback, makeCtx({ recentEvents: [oreb] }))).toEqual([]);
  });

  it('BR-STAT-2.5: block without a recorded field-goal attempt → MissingFGA flag', () => {
    const dribbleEra = makeEvent({ id: E_MISC, statType: 'AST', playerId: P1, teamId: TEAM_A });
    const block = makeEvent({ id: E_CAND, statType: 'BLK', playerId: P3, teamId: TEAM_B });

    const results = validateAction(block, makeCtx({ recentEvents: [dribbleEra] }));

    const flag = findFlag(results, 'BR-STAT-2.5');
    expect(flag).toBeDefined();
    expect(flag!.isValid).toBe(false);
    expect(flag!.flagKind).toBe('MissingFGA');
  });

  it('BR-STAT-2.5: block linked to a shot attempt → valid', () => {
    const attempt = makeEvent({ id: E_SHOT, statType: '2PA', playerId: P1, teamId: TEAM_A });
    const block = makeEvent({ id: E_CAND, statType: 'BLK', playerId: P3, teamId: TEAM_B, linkedActionId: E_SHOT });

    expect(validateAction(block, makeCtx({ recentEvents: [attempt] }))).toEqual([]);
  });

  it('BR-STAT-2.7: own basket — FGM by the team NOT in possession → credit offensive court captain', () => {
    const ownBasket = makeEvent({ id: E_CAND, statType: '2PM', playerId: P3, teamId: TEAM_B });

    const results = validateAction(
      ownBasket,
      makeCtx({ currentPossession: { teamId: TEAM_A, arrowTeamId: null, isPending: false } }),
    );

    const flag = findFlag(results, 'BR-STAT-2.7');
    expect(flag).toBeDefined();
    expect(flag!.isValid).toBe(false);
    expect(flag!.flagKind).toBe('AutoCorrect');
  });

  it('BR-STAT-2.8: offensive goaltending — interference by the shooting team → TO replaces FGA', () => {
    const attempt = makeEvent({ id: E_SHOT, statType: '2PA', playerId: P1, teamId: TEAM_A });
    const interference = makeEvent({ id: E_CAND, statType: 'BLK', playerId: P2, teamId: TEAM_A, linkedActionId: E_SHOT });

    const results = validateAction(interference, makeCtx({ recentEvents: [attempt] }));

    const flag = findFlag(results, 'BR-STAT-2.8');
    expect(flag).toBeDefined();
    expect(flag!.flagKind).toBe('AutoCorrect');
    expect(flag!.linkedEventIds).toEqual([E_SHOT]);
  });
});

describe('STAT-3 — free throws', () => {
  it('BR-STAT-3.7: technical FT at 00:00 after the period ended → credit to the next period', () => {
    const periodEnd = makeEvent({ statType: 'PERIOD_END', playerId: null, teamId: null, period: 1, clockTimeSeconds: 0 });
    const ft = makeEvent({ id: E_CAND, statType: 'FTM', playerId: P1, teamId: TEAM_A, period: 1, clockTimeSeconds: 0 });

    const results = validateAction(ft, makeCtx({ recentEvents: [periodEnd], clockTimeSeconds: 0 }));

    const flag = findFlag(results, 'BR-STAT-3.7');
    expect(flag).toBeDefined();
    expect(flag!.flagKind).toBe('AutoCorrect');
    expect(flag!.message).toContain('period 2');
  });

  it('BR-STAT-3.7: FT during live play (clock > 0) → no flag', () => {
    const ft = makeEvent({ id: E_CAND, statType: 'FTM', playerId: P1, teamId: TEAM_A, clockTimeSeconds: 120 });
    expect(validateAction(ft, makeCtx())).toEqual([]);
  });
});

describe('STAT-4 — rebounds', () => {
  it('BR-STAT-4.3-A: team rebound carrying a playerId → auto-correct clears the player', () => {
    const badTeamReb = makeEvent({ id: E_CAND, statType: 'DREB', playerId: P1, teamId: TEAM_A, isTeamRebound: true });

    const results = validateAction(badTeamReb, makeCtx());

    const flag = findFlag(results, 'BR-STAT-4.3');
    expect(flag).toBeDefined();
    expect(flag!.isValid).toBe(false);
    expect(flag!.flagKind).toBe('AutoCorrect');
  });

  it('BR-STAT-4.3-B: rebound without a player not marked as team rebound → review flag', () => {
    const orphanReb = makeEvent({ id: E_CAND, statType: 'OREB', playerId: null, teamId: TEAM_A, isTeamRebound: false });

    const results = validateAction(orphanReb, makeCtx());

    const flag = findFlag(results, 'BR-STAT-4.3');
    expect(flag).toBeDefined();
    expect(flag!.flagKind).toBe('User');
  });

  it('BR-STAT-4.3-C: proper team rebound (no player, flagged) → valid', () => {
    const teamReb = makeEvent({ id: E_CAND, statType: 'DREB', playerId: null, teamId: TEAM_B, isTeamRebound: true });
    expect(validateAction(teamReb, makeCtx())).toEqual([]);
  });

  it('BR-STAT-4.4: rebound after a missed NON-last free throw of the sequence → invalid', () => {
    const foul = makeEvent({ id: E_FOUL, statType: 'PF', playerId: P3, teamId: TEAM_B });
    const ft1 = makeEvent({ id: E_FT1, statType: 'FTA', playerId: P1, teamId: TEAM_A, linkedActionId: E_FOUL, linkRole: 'ft_for_foul' });
    const rebound = makeEvent({ id: E_CAND, statType: 'DREB', playerId: P3, teamId: TEAM_B });

    const results = validateAction(rebound, makeCtx({ recentEvents: [foul, ft1] }));

    const flag = findFlag(results, 'BR-STAT-4.4');
    expect(flag).toBeDefined();
    expect(flag!.isValid).toBe(false);
    expect(flag!.linkedEventIds).toEqual([E_FT1]);
  });

  it('BR-STAT-4.4: rebound after the LAST missed free throw of a 2-shot sequence → valid', () => {
    const foul = makeEvent({ id: E_FOUL, statType: 'PF', playerId: P3, teamId: TEAM_B });
    const ft1 = makeEvent({ id: E_FT1, statType: 'FTM', playerId: P1, teamId: TEAM_A, linkedActionId: E_FOUL, linkRole: 'ft_for_foul' });
    const ft2 = makeEvent({ id: E_FT2, statType: 'FTA', playerId: P1, teamId: TEAM_A, linkedActionId: E_FOUL, linkRole: 'ft_for_foul' });
    const rebound = makeEvent({ id: E_CAND, statType: 'DREB', playerId: P3, teamId: TEAM_B });

    expect(validateAction(rebound, makeCtx({ recentEvents: [foul, ft1, ft2] }))).toEqual([]);
  });

  it('BR-STAT-4.5: player OREB + immediate TO by the same player → team DREB to the other team', () => {
    const oreb = makeEvent({ id: E_OREB, statType: 'OREB', playerId: P1, teamId: TEAM_A, clockTimeSeconds: 200 });
    const turnover = makeEvent({ id: E_CAND, statType: 'TO', playerId: P1, teamId: TEAM_A, clockTimeSeconds: 200 });

    const results = validateAction(turnover, makeCtx({ recentEvents: [oreb] }));

    const flag = findFlag(results, 'BR-STAT-4.5');
    expect(flag).toBeDefined();
    expect(flag!.flagKind).toBe('AutoCorrect');
    expect(flag!.linkedEventIds).toEqual([E_OREB]);
  });

  it('BR-STAT-4.5: OREB followed by a later turnover (different clock) → valid controlled rebound', () => {
    const oreb = makeEvent({ id: E_OREB, statType: 'OREB', playerId: P1, teamId: TEAM_A, clockTimeSeconds: 200 });
    const turnover = makeEvent({ id: E_CAND, statType: 'TO', playerId: P1, teamId: TEAM_A, clockTimeSeconds: 190 });

    expect(validateAction(turnover, makeCtx({ recentEvents: [oreb] }))).toEqual([]);
  });
});

describe('STAT-5 — turnovers', () => {
  it('BR-STAT-5.3: offensive foul (foul by the team in possession) → auto-insert TO on the fouler', () => {
    const offensiveFoul = makeEvent({ id: E_CAND, statType: 'PF', playerId: P1, teamId: TEAM_A });

    const results = validateAction(
      offensiveFoul,
      makeCtx({ currentPossession: { teamId: TEAM_A, arrowTeamId: null, isPending: false } }),
    );

    const flag = findFlag(results, 'BR-STAT-5.3');
    expect(flag).toBeDefined();
    expect(flag!.flagKind).toBe('AutoCorrect');
    expect(flag!.message).toContain('to_after_offensive_foul');
  });

  it('BR-STAT-5.3: defensive foul (foul by the team NOT in possession) → no turnover inserted', () => {
    const defensiveFoul = makeEvent({ id: E_CAND, statType: 'PF', playerId: P3, teamId: TEAM_B });

    expect(
      validateAction(
        defensiveFoul,
        makeCtx({ currentPossession: { teamId: TEAM_A, arrowTeamId: null, isPending: false } }),
      ),
    ).toEqual([]);
  });
});

describe('STAT-6 — assists', () => {
  it('BR-STAT-6.3: receiver dribbled before shooting (2+ s between pass and basket) → non-blocking review', () => {
    const made = makeEvent({ id: E_SHOT, statType: '2PM', playerId: P2, teamId: TEAM_A, clockTimeSeconds: 295 });
    const assist = makeEvent({ id: E_CAND, statType: 'AST', playerId: P1, teamId: TEAM_A, linkedActionId: E_SHOT, linkRole: 'assist_after_made', clockTimeSeconds: 299 });

    const results = validateAction(assist, makeCtx({ recentEvents: [made] }));

    const flag = findFlag(results, 'BR-STAT-6.3');
    expect(flag).toBeDefined();
    expect(flag!.isValid).toBe(true); // non-blocking
    expect(flag!.flagKind).toBe('User');
  });

  it('BR-STAT-6.3: immediate catch-and-shoot assist → no flag', () => {
    const made = makeEvent({ id: E_SHOT, statType: '2PM', playerId: P2, teamId: TEAM_A, clockTimeSeconds: 299 });
    const assist = makeEvent({ id: E_CAND, statType: 'AST', playerId: P1, teamId: TEAM_A, linkedActionId: E_SHOT, linkRole: 'assist_after_made', clockTimeSeconds: 299 });

    expect(validateAction(assist, makeCtx({ recentEvents: [made] }))).toEqual([]);
  });
});

describe('STAT-7 — steals', () => {
  it('BR-STAT-7.3: steal recorded immediately after a dead ball → review flag to remove it', () => {
    const timeout = makeEvent({ id: E_MISC, statType: 'TIMEOUT', playerId: null, teamId: TEAM_A });
    const steal = makeEvent({ id: E_CAND, statType: 'STL', playerId: P3, teamId: TEAM_B });

    const results = validateAction(steal, makeCtx({ recentEvents: [timeout] }));

    const flag = findFlag(results, 'BR-STAT-7.3');
    expect(flag).toBeDefined();
    expect(flag!.isValid).toBe(false);
    expect(flag!.flagKind).toBe('User');
  });
});

describe('STAT-8 — blocks', () => {
  it('BR-STAT-8.3: block recorded after the rebound resolved the shot (rim contact) → invalid', () => {
    const attempt = makeEvent({ id: E_SHOT, statType: '2PA', playerId: P1, teamId: TEAM_A });
    const rebound = makeEvent({ id: E_OREB, statType: 'DREB', playerId: P3, teamId: TEAM_B });
    const block = makeEvent({ id: E_CAND, statType: 'BLK', playerId: P3, teamId: TEAM_B, linkedActionId: E_SHOT });

    const results = validateAction(block, makeCtx({ recentEvents: [attempt, rebound] }));

    const flag = findFlag(results, 'BR-STAT-8.3');
    expect(flag).toBeDefined();
    expect(flag!.isValid).toBe(false);
    expect(flag!.flagKind).toBe('User');
  });
});

describe('STAT-9 — fouls', () => {
  it('BR-STAT-9.2: bench foul attributed to an on-court player → review flag', () => {
    const benchFoul = makeEvent({ id: E_CAND, statType: 'TF', playerId: P1, teamId: TEAM_A, isBenchFoul: true });

    const results = validateAction(benchFoul, makeCtx({ onCourtPlayerIds: [P1, P2, P3] }));

    const flag = findFlag(results, 'BR-STAT-9.2');
    expect(flag).toBeDefined();
    expect(flag!.isValid).toBe(false);
    expect(flag!.flagKind).toBe('User');
  });

  it('BR-STAT-9.2: coach technical (bench foul, no on-court player) → valid', () => {
    const coachT = makeEvent({ id: E_CAND, statType: 'TF', playerId: null, teamId: TEAM_A, isBenchFoul: true });
    expect(validateAction(coachT, makeCtx())).toEqual([]);
  });
});
