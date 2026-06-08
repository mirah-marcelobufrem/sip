import {
  aggregatePlayerEvents,
  deriveStats,
  classifyShotZone,
  detectScoringRuns,
} from '../../../src/domain/stat-calculators.js';
import type { StatEvent } from '../../../src/domain/entities/game.entity.js';

function makeEvent(overrides: Partial<StatEvent> = {}): StatEvent {
  return {
    id: 'e1',
    gameId: 'g1',
    period: 1,
    clockTimeSeconds: 600,
    playerId: 'p1',
    teamId: 't1',
    statType: '2PM',
    value: 1,
    xCourt: null,
    yCourt: null,
    lineupSnapshotId: null,
    seq: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('aggregatePlayerEvents', () => {
  it('correctly counts made 2-pointers as 2 pts', () => {
    const events = [makeEvent({ statType: '2PM' }), makeEvent({ statType: '2PM' })];
    const box = aggregatePlayerEvents(events);
    expect(box.pts).toBe(4);
    expect(box.twopm).toBe(2);
    expect(box.fgm).toBe(2);
  });

  it('counts 3-pointers as 3 pts', () => {
    const events = [makeEvent({ statType: '3PM' })];
    const box = aggregatePlayerEvents(events);
    expect(box.pts).toBe(3);
    expect(box.threepm).toBe(1);
    expect(box.fgm).toBe(1);
  });

  it('counts free throws as 1 pt', () => {
    const box = aggregatePlayerEvents([makeEvent({ statType: 'FTM' })]);
    expect(box.pts).toBe(1);
    expect(box.ftm).toBe(1);
  });

  it('aggregates rebounds correctly', () => {
    const events = [makeEvent({ statType: 'OREB' }), makeEvent({ statType: 'DREB' })];
    const box = aggregatePlayerEvents(events);
    expect(box.oreb).toBe(1);
    expect(box.dreb).toBe(1);
    expect(box.reb).toBe(2);
  });
});

describe('deriveStats', () => {
  it('calculates FG% correctly', () => {
    const box = aggregatePlayerEvents([
      makeEvent({ statType: '2PM' }),
      makeEvent({ statType: '2PA' }),
      makeEvent({ statType: '2PM' }),
    ]);
    const derived = deriveStats(box);
    expect(derived.fgPct).toBeCloseTo(2 / 3);
  });

  it('returns null FG% when no attempts', () => {
    const box = aggregatePlayerEvents([makeEvent({ statType: 'AST' })]);
    expect(deriveStats(box).fgPct).toBeNull();
  });

  it('calculates eFG% correctly', () => {
    const events = [makeEvent({ statType: '3PM' }), makeEvent({ statType: '2PA' })];
    const box = aggregatePlayerEvents(events);
    const derived = deriveStats(box);
    // eFG% = (1 + 0.5 * 1) / 2 = 0.75
    expect(derived.efgPct).toBeCloseTo(0.75);
  });
});

describe('classifyShotZone', () => {
  it('classifies basket area as restricted_area', () => {
    expect(classifyShotZone(0.5, 0.08)).toBe('restricted_area');
  });

  it('classifies paint mid-range as paint', () => {
    expect(classifyShotZone(0.5, 0.25)).toBe('paint');
  });

  it('classifies left corner as left_corner_3', () => {
    expect(classifyShotZone(0.05, 0.1)).toBe('left_corner_3');
  });

  it('classifies right corner as right_corner_3', () => {
    expect(classifyShotZone(0.95, 0.1)).toBe('right_corner_3');
  });

  it('classifies top of arc as top_arc_3', () => {
    expect(classifyShotZone(0.5, 0.9)).toBe('top_arc_3');
  });
});

describe('detectScoringRuns', () => {
  it('detects a simple scoring run', () => {
    const events: StatEvent[] = [
      makeEvent({ statType: '2PM', teamId: 't1', clockTimeSeconds: 600 }),
      makeEvent({ statType: '2PM', teamId: 't1', clockTimeSeconds: 550 }),
      makeEvent({ statType: '2PM', teamId: 't1', clockTimeSeconds: 500 }),
      makeEvent({ statType: '2PM', teamId: 't2', clockTimeSeconds: 450 }),
    ];
    const runs = detectScoringRuns(events, 5);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.teamId).toBe('t1');
    expect(runs[0]!.points).toBe(6);
  });

  it('returns no runs below threshold', () => {
    const events = [
      makeEvent({ statType: '2PM', teamId: 't1' }),
      makeEvent({ statType: '2PM', teamId: 't2' }),
    ];
    expect(detectScoringRuns(events, 5)).toHaveLength(0);
  });
});
