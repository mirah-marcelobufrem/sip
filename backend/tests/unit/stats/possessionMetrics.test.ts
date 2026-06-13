import {
  compute2CP,
  computeBenchPoints,
  computePIP,
  computePOT,
  computePPP,
} from '../../../src/domain/stat-calculators.js';
import type { PossessionSequence, StatEvent } from '../../../src/domain/entities/game.entity.js';

const GAME_ID = '00000000-0000-0000-0000-000000000001';
const TEAM_A = '00000000-0000-0000-0000-00000000000a';
const TEAM_B = '00000000-0000-0000-0000-00000000000b';
const P1 = '00000000-0000-0000-0000-000000000010';
const P2 = '00000000-0000-0000-0000-000000000011';
const P3 = '00000000-0000-0000-0000-000000000012';

let eventCounter = 0;
function makeEvent(overrides: Partial<StatEvent> = {}): StatEvent {
  eventCounter += 1;
  return {
    id: `00000000-0000-0000-0000-0000000002${String(eventCounter).padStart(2, '0')}`,
    gameId: GAME_ID,
    period: 1,
    clockTimeSeconds: null,
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

let seqCounter = 0;
function makeSequence(overrides: Partial<PossessionSequence> = {}): PossessionSequence {
  seqCounter += 1;
  return {
    id: `00000000-0000-0000-0000-0000000003${String(seqCounter).padStart(2, '0')}`,
    gameId: GAME_ID,
    period: 1,
    clockTimeSeconds: 0,
    teamId: TEAM_A,
    startActionId: null,
    endActionId: null,
    isOffensiveReboundContinuation: false,
    createdAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  eventCounter = 0;
  seqCounter = 0;
});

describe('computePPP (N-04)', () => {
  it('FIBA spec vector: 5 points over 2 possessions → 2.5', () => {
    // A scores 2PM (closing its opening possession), B turns it over,
    // A scores 3PM off the turnover (closing its second possession).
    const e1 = makeEvent({ statType: '2PM', teamId: TEAM_A });
    const e2 = makeEvent({ statType: 'TO', teamId: TEAM_B, playerId: P3 });
    const e3 = makeEvent({ statType: '3PM', teamId: TEAM_A });
    const events = [e1, e2, e3];

    const sequences = [
      makeSequence({ teamId: TEAM_A, startActionId: null, endActionId: e1.id }),
      makeSequence({ teamId: TEAM_B, startActionId: e1.id, endActionId: e2.id }),
      makeSequence({ teamId: TEAM_A, startActionId: e2.id, endActionId: e3.id }),
      makeSequence({ teamId: TEAM_B, startActionId: e3.id, endActionId: null }),
    ];

    expect(computePPP(events, sequences, TEAM_A)).toBe(2.5);
    expect(computePPP(events, sequences, TEAM_B)).toBe(0);
  });

  it('does not count an offensive-rebound continuation as a new possession', () => {
    const e1 = makeEvent({ statType: '2PA', teamId: TEAM_A }); // miss
    const e2 = makeEvent({ statType: 'OREB', teamId: TEAM_A, playerId: P2 });
    const e3 = makeEvent({ statType: '2PM', teamId: TEAM_A });
    const events = [e1, e2, e3];

    const sequences = [
      makeSequence({ teamId: TEAM_A, startActionId: null, endActionId: e2.id }),
      makeSequence({
        teamId: TEAM_A,
        startActionId: e2.id,
        endActionId: e3.id,
        isOffensiveReboundContinuation: true,
      }),
    ];

    // 2 points over ONE possession (continuation is the same possession)
    expect(computePPP(events, sequences, TEAM_A)).toBe(2);
  });

  it('returns null when the team has no recorded possessions', () => {
    expect(computePPP([], [], TEAM_A)).toBeNull();
  });
});

describe('computePOT (N-04, points off turnovers)', () => {
  it('counts points in possessions started by an opponent TO', () => {
    const e1 = makeEvent({ statType: '2PM', teamId: TEAM_A }); // normal possession (control)
    const e2 = makeEvent({ statType: 'TO', teamId: TEAM_B, playerId: P3 });
    const e3 = makeEvent({ statType: '3PM', teamId: TEAM_A });
    const events = [e1, e2, e3];

    const sequences = [
      makeSequence({ teamId: TEAM_A, startActionId: null, endActionId: e1.id }),
      makeSequence({ teamId: TEAM_B, startActionId: e1.id, endActionId: e2.id }),
      makeSequence({ teamId: TEAM_A, startActionId: e2.id, endActionId: e3.id }),
    ];

    // Only the 3PM came off a turnover — the opening 2PM does not qualify
    expect(computePOT(events, sequences, TEAM_A)).toBe(3);
  });

  it('counts points in possessions started by an own steal', () => {
    const e1 = makeEvent({ statType: 'STL', teamId: TEAM_A, playerId: P2 });
    const e2 = makeEvent({ statType: '2PM', teamId: TEAM_A });
    const events = [e1, e2];

    const sequences = [
      makeSequence({ teamId: TEAM_B, startActionId: null, endActionId: e1.id }),
      makeSequence({ teamId: TEAM_A, startActionId: e1.id, endActionId: e2.id }),
    ];

    expect(computePOT(events, sequences, TEAM_A)).toBe(2);
  });

  it('follows offensive-rebound continuations of a turnover possession', () => {
    const e1 = makeEvent({ statType: 'TO', teamId: TEAM_B, playerId: P3 });
    const e2 = makeEvent({ statType: '2PA', teamId: TEAM_A }); // miss
    const e3 = makeEvent({ statType: 'OREB', teamId: TEAM_A, playerId: P2 });
    const e4 = makeEvent({ statType: '2PM', teamId: TEAM_A }); // second-chance bucket
    const events = [e1, e2, e3, e4];

    const sequences = [
      makeSequence({ teamId: TEAM_B, startActionId: null, endActionId: e1.id }),
      makeSequence({ teamId: TEAM_A, startActionId: e1.id, endActionId: e3.id }),
      makeSequence({
        teamId: TEAM_A,
        startActionId: e3.id,
        endActionId: e4.id,
        isOffensiveReboundContinuation: true,
      }),
    ];

    // The continuation belongs to the same turnover-born possession
    expect(computePOT(events, sequences, TEAM_A)).toBe(2);
  });

  it('does not count possessions gained any other way (e.g. after a made basket)', () => {
    const e1 = makeEvent({ statType: '2PM', teamId: TEAM_B, playerId: P3 });
    const e2 = makeEvent({ statType: '3PM', teamId: TEAM_A });
    const events = [e1, e2];

    const sequences = [
      makeSequence({ teamId: TEAM_B, startActionId: null, endActionId: e1.id }),
      makeSequence({ teamId: TEAM_A, startActionId: e1.id, endActionId: e2.id }),
    ];

    expect(computePOT(events, sequences, TEAM_A)).toBe(0);
  });
});

describe('compute2CP (N-04, second-chance points)', () => {
  it('counts only points scored in continuation sequences', () => {
    const e1 = makeEvent({ statType: '2PM', teamId: TEAM_A }); // first-chance points
    const e2 = makeEvent({ statType: '2PA', teamId: TEAM_A });
    const e3 = makeEvent({ statType: 'OREB', teamId: TEAM_A, playerId: P2 });
    const e4 = makeEvent({ statType: '2PM', teamId: TEAM_A }); // second-chance points
    const events = [e1, e2, e3, e4];

    const sequences = [
      makeSequence({ teamId: TEAM_A, startActionId: null, endActionId: e1.id }),
      makeSequence({ teamId: TEAM_A, startActionId: e1.id, endActionId: e3.id }),
      makeSequence({
        teamId: TEAM_A,
        startActionId: e3.id,
        endActionId: e4.id,
        isOffensiveReboundContinuation: true,
      }),
    ];

    expect(compute2CP(events, sequences, TEAM_A)).toBe(2);
  });

  it('returns 0 when there are no continuation sequences', () => {
    const e1 = makeEvent({ statType: '2PM', teamId: TEAM_A });
    const sequences = [makeSequence({ teamId: TEAM_A, startActionId: null, endActionId: e1.id })];
    expect(compute2CP([e1], sequences, TEAM_A)).toBe(0);
  });
});

describe('computePIP (N-04, points in the paint — STORAGE frame)', () => {
  it('counts 2PM in the restricted area and the key; ignores mid-range, 3PM and coordinate-less shots', () => {
    const events = [
      // Restricted area: 0.518 m from the basket center (0.5, 0.113)
      makeEvent({ statType: '2PM', teamId: TEAM_A, xCourt: 0.5, yCourt: 0.15 }),
      // Paint (key): inside x 0.337–0.663, y < 0.414, outside the 1.25 m arc
      makeEvent({ statType: '2PM', teamId: TEAM_A, xCourt: 0.5, yCourt: 0.3 }),
      // Mid-range: beyond the key depth
      makeEvent({ statType: '2PM', teamId: TEAM_A, xCourt: 0.5, yCourt: 0.5 }),
      // 3PM can never be paint
      makeEvent({ statType: '3PM', teamId: TEAM_A, xCourt: 0.5, yCourt: 0.7 }),
      // No coordinates → never counted
      makeEvent({ statType: '2PM', teamId: TEAM_A }),
      // Other team's paint bucket → not ours
      makeEvent({ statType: '2PM', teamId: TEAM_B, playerId: P3, xCourt: 0.5, yCourt: 0.3 }),
    ];

    expect(computePIP(events, TEAM_A)).toBe(4);
    expect(computePIP(events, TEAM_B)).toBe(2);
  });
});

describe('computeBenchPoints (N-04)', () => {
  it('counts points by non-starters only, skipping team-level events', () => {
    const events = [
      makeEvent({ statType: '2PM', teamId: TEAM_A, playerId: P1 }), // starter
      makeEvent({ statType: '3PM', teamId: TEAM_A, playerId: P2 }), // bench +3
      makeEvent({ statType: 'FTM', teamId: TEAM_A, playerId: P3 }), // bench +1
      makeEvent({ statType: 'FTM', teamId: TEAM_A, playerId: null }), // team-level → skipped
      makeEvent({ statType: '2PM', teamId: TEAM_B, playerId: P3 }), // other team → skipped
    ];

    expect(computeBenchPoints(events, TEAM_A, [P1])).toBe(4);
  });

  it('returns 0 when every scorer is a starter', () => {
    const events = [makeEvent({ statType: '2PM', teamId: TEAM_A, playerId: P1 })];
    expect(computeBenchPoints(events, TEAM_A, [P1, P2])).toBe(0);
  });
});
