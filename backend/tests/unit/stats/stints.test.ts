import { computePlayerStints } from '../../../src/domain/stat-calculators.js';
import type { LineupSnapshot, StatEvent } from '../../../src/domain/entities/game.entity.js';

const GAME_ID = '00000000-0000-0000-0000-000000000001';
const HOME = '00000000-0000-0000-0000-000000000002';
const AWAY = '00000000-0000-0000-0000-000000000003';
const A = '00000000-0000-0000-0000-000000000010';
const B = '00000000-0000-0000-0000-000000000011';
const C = '00000000-0000-0000-0000-000000000012';
const X = '00000000-0000-0000-0000-000000000020';
const Y = '00000000-0000-0000-0000-000000000021';
const SNAP_HOME_INITIAL = '00000000-0000-0000-0000-000000000030';
const SNAP_HOME_SUB = '00000000-0000-0000-0000-000000000031';
const SNAP_AWAY_INITIAL = '00000000-0000-0000-0000-000000000032';

const GAME_4X10 = { numPeriods: 4, periodDurationMinutes: 10 };

let eventCounter = 0;
function makeEvent(overrides: Partial<StatEvent> = {}): StatEvent {
  eventCounter += 1;
  return {
    id: `00000000-0000-0000-0000-0000000001${String(eventCounter).padStart(2, '0')}`,
    gameId: GAME_ID,
    period: 1,
    clockTimeSeconds: null,
    playerId: A,
    teamId: HOME,
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

function makeSnapshot(overrides: Partial<LineupSnapshot> = {}): LineupSnapshot {
  return {
    id: SNAP_HOME_INITIAL,
    gameId: GAME_ID,
    teamId: HOME,
    period: 1,
    clockTimeSeconds: 0,
    playerIds: [A, B],
    ...overrides,
  };
}

beforeEach(() => {
  eventCounter = 0;
});

describe('computePlayerStints (N-01, v1 proportional approximation)', () => {
  it('credits the full game to starters who are never substituted', () => {
    const snapshots = [
      makeSnapshot(),
      makeSnapshot({ id: SNAP_AWAY_INITIAL, teamId: AWAY, playerIds: [X, Y] }),
    ];
    // One home and one away scoring event per period keeps every period alive
    const events: StatEvent[] = [];
    for (let p = 1; p <= 4; p++) {
      events.push(makeEvent({ period: p, statType: '2PM', playerId: A, teamId: HOME }));
      events.push(makeEvent({ period: p, statType: '3PM', playerId: X, teamId: AWAY }));
    }

    const totals = computePlayerStints(events, snapshots, GAME_4X10);

    // 4 periods × 600 s
    expect(totals.get(A)?.minSeconds).toBe(2400);
    expect(totals.get(B)?.minSeconds).toBe(2400);
    expect(totals.get(X)?.minSeconds).toBe(2400);

    // Per period: home +2, away +3 → home −1/period, away +1/period
    expect(totals.get(A)?.plusMinus).toBe(-4);
    expect(totals.get(B)?.plusMinus).toBe(-4);
    expect(totals.get(X)?.plusMinus).toBe(4);
    expect(totals.get(Y)?.plusMinus).toBe(4);
  });

  it('splits a period proportionally at a substitution boundary (one boundary per snapshot)', () => {
    const snapshots = [
      makeSnapshot({ playerIds: [A, B] }),
      makeSnapshot({ id: SNAP_HOME_SUB, playerIds: [A, C] }),
    ];

    // 10 events in period 1; SUB pair at indices 4 and 5 (same snapshot id)
    const events: StatEvent[] = [
      makeEvent({ statType: '2PM', playerId: A, teamId: HOME }), // 0
      makeEvent({ statType: '2PA', playerId: A, teamId: HOME }), // 1
      makeEvent({ statType: '3PM', playerId: X, teamId: AWAY }), // 2
      makeEvent({ statType: 'PF', playerId: B, teamId: HOME }), // 3
      makeEvent({ statType: 'SUB_OUT', playerId: B, teamId: HOME, lineupSnapshotId: SNAP_HOME_SUB }), // 4
      makeEvent({ statType: 'SUB_IN', playerId: C, teamId: HOME, lineupSnapshotId: SNAP_HOME_SUB }), // 5
      makeEvent({ statType: '2PA', playerId: C, teamId: HOME }), // 6
      makeEvent({ statType: 'FTM', playerId: A, teamId: HOME }), // 7
      makeEvent({ statType: 'TO', playerId: X, teamId: AWAY }), // 8
      makeEvent({ statType: 'DREB', playerId: C, teamId: HOME }), // 9
    ];

    const totals = computePlayerStints(events, snapshots, GAME_4X10);

    // Boundary at index 4 of 10 → 40% / 60% of a 600 s period
    expect(totals.get(A)?.minSeconds).toBe(600);
    expect(totals.get(B)?.minSeconds).toBe(240);
    expect(totals.get(C)?.minSeconds).toBe(360);

    // Segment 1 (events 0–3): home 2PM (+2), away 3PM (−3) → −1 for A and B
    // Segment 2 (events 4–9): home FTM (+1) → +1 for A and C
    expect(totals.get(B)?.plusMinus).toBe(-1);
    expect(totals.get(C)?.plusMinus).toBe(1);
    expect(totals.get(A)?.plusMinus).toBe(0);
  });

  it('accrues nothing for players absent from every snapshot', () => {
    const snapshots = [makeSnapshot({ playerIds: [A, B] })];
    const events = [
      makeEvent({ statType: '2PM', playerId: A, teamId: HOME }),
      makeEvent({ statType: 'PF', playerId: C, teamId: HOME }), // C never in a lineup
    ];

    const totals = computePlayerStints(events, snapshots, GAME_4X10);
    expect(totals.get(A)?.minSeconds).toBe(600);
    expect(totals.has(C)).toBe(false);
  });

  it('accrues nothing for a team without snapshots (no data is invented)', () => {
    const snapshots = [makeSnapshot({ playerIds: [A, B] })]; // home only
    const events = [
      makeEvent({ statType: '2PM', playerId: A, teamId: HOME }),
      makeEvent({ statType: '3PM', playerId: X, teamId: AWAY }),
    ];

    const totals = computePlayerStints(events, snapshots, GAME_4X10);
    expect(totals.has(X)).toBe(false);
    expect(totals.has(Y)).toBe(false);
    // Home starters still tracked, with the away basket counted against them
    expect(totals.get(A)?.plusMinus).toBe(-1);
  });

  it('carries the lineup across period boundaries and skips empty periods', () => {
    const snapshots = [makeSnapshot({ playerIds: [A] })];
    const events = [
      makeEvent({ period: 1, statType: '2PM', playerId: A, teamId: HOME }),
      // period 2 has no events — contributes nothing
      makeEvent({ period: 3, statType: '2PM', playerId: A, teamId: HOME }),
    ];

    const totals = computePlayerStints(events, snapshots, GAME_4X10);
    expect(totals.get(A)?.minSeconds).toBe(1200); // periods 1 and 3 only
  });

  it('returns an empty map when there are no snapshots at all', () => {
    const events = [makeEvent({ statType: '2PM', playerId: A, teamId: HOME })];
    const totals = computePlayerStints(events, [], GAME_4X10);
    expect(totals.size).toBe(0);
  });
});
