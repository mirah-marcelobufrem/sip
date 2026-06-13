import { computePer36, computePerMinutes, type PlayerBoxScore } from '../../../src/domain/stat-calculators.js';

function makeBox(overrides: Partial<PlayerBoxScore> = {}): PlayerBoxScore {
  return {
    playerId: '00000000-0000-0000-0000-000000000010',
    gamesPlayed: 1,
    pts: 10, fgm: 4, fga: 8,
    twopm: 3, twopa: 2, threepm: 1, threepa: 2,
    ftm: 1, fta: 1,
    oreb: 1, dreb: 3, reb: 4,
    ast: 2, to: 1,
    stl: 1, blk: 0, dfd: 0,
    pf: 2, tf: 0, ff: 0,
    minSeconds: 1200, // 20 minutes
    plusMinus: 5,
    ...overrides,
  };
}

describe('computePerMinutes (N-13)', () => {
  it('normalizes to a 40-minute FIBA base', () => {
    const per40 = computePerMinutes(makeBox(), 40);
    expect(per40).not.toBeNull();
    // 20 minutes played → factor 2
    expect(per40!.pts).toBe(20);
    expect(per40!.reb).toBe(8);
    expect(per40!.ast).toBe(4);
  });

  it('normalizes to a 36-minute base', () => {
    const per36 = computePerMinutes(makeBox(), 36);
    expect(per36).not.toBeNull();
    // factor = 2160 / 1200 = 1.8
    expect(per36!.pts).toBeCloseTo(18, 10);
    expect(per36!.reb).toBeCloseTo(7.2, 10);
  });

  it('returns null below the 30-second sample threshold', () => {
    expect(computePerMinutes(makeBox({ minSeconds: 29 }), 40)).toBeNull();
    expect(computePerMinutes(makeBox({ minSeconds: 0 }), 40)).toBeNull();
  });

  it('keeps computePer36 as an exact 36-minute wrapper (legacy callers)', () => {
    const viaWrapper = computePer36(makeBox());
    const direct = computePerMinutes(makeBox(), 36);
    expect(viaWrapper).toEqual(direct);
  });
});
