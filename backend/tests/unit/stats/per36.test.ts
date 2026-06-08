import { computePer36 } from '../../../src/domain/stat-calculators.js';
import type { PlayerBoxScore } from '../../../src/domain/stat-calculators.js';

function makeBox(overrides: Partial<PlayerBoxScore> = {}): PlayerBoxScore {
  return {
    playerId: 'p1',
    gamesPlayed: 1,
    pts: 0, fgm: 0, fga: 0,
    twopm: 0, twopa: 0, threepm: 0, threepa: 0,
    ftm: 0, fta: 0,
    oreb: 0, dreb: 0, reb: 0,
    ast: 0, to: 0,
    stl: 0, blk: 0, dfd: 0,
    pf: 0, tf: 0, ff: 0,
    minSeconds: 0,
    plusMinus: 0,
    ...overrides,
  };
}

describe('computePer36', () => {
  it('returns null when minSeconds < 30 (insufficient sample)', () => {
    const box = makeBox({ minSeconds: 29, pts: 10 });
    expect(computePer36(box)).toBeNull();
  });

  it('returns null for minSeconds === 0', () => {
    const box = makeBox({ minSeconds: 0, pts: 5 });
    expect(computePer36(box)).toBeNull();
  });

  it('returns values unchanged when minSeconds === 2160 (exactly 36 minutes)', () => {
    const box = makeBox({
      minSeconds: 2160,
      pts: 24, fgm: 9, fga: 18,
      twopm: 6, twopa: 10, threepm: 3, threepa: 8,
      ftm: 3, fta: 4,
      oreb: 2, dreb: 5, reb: 7,
      ast: 4, to: 2, stl: 1, blk: 1, pf: 3,
    });
    const result = computePer36(box);
    expect(result).not.toBeNull();
    expect(result!.pts).toBeCloseTo(24);
    expect(result!.ast).toBeCloseTo(4);
    expect(result!.reb).toBeCloseTo(7);
    expect(result!.fgm).toBeCloseTo(9);
    expect(result!.fga).toBeCloseTo(18);
  });

  it('doubles values when minSeconds === 1080 (18 minutes)', () => {
    const box = makeBox({
      minSeconds: 1080,
      pts: 12,
      fgm: 4, fga: 9,
      twopm: 3, twopa: 5, threepm: 1, threepa: 4,
      ftm: 2, fta: 3,
      oreb: 1, dreb: 3, reb: 4,
      ast: 3, to: 1, stl: 1, blk: 0, pf: 2,
    });
    const result = computePer36(box);
    expect(result).not.toBeNull();
    expect(result!.pts).toBeCloseTo(24);
    expect(result!.fgm).toBeCloseTo(8);
    expect(result!.fga).toBeCloseTo(18);
    expect(result!.twopm).toBeCloseTo(6);
    expect(result!.twopa).toBeCloseTo(10);
    expect(result!.threepm).toBeCloseTo(2);
    expect(result!.threepa).toBeCloseTo(8);
    expect(result!.ftm).toBeCloseTo(4);
    expect(result!.fta).toBeCloseTo(6);
    expect(result!.oreb).toBeCloseTo(2);
    expect(result!.dreb).toBeCloseTo(6);
    expect(result!.reb).toBeCloseTo(8);
    expect(result!.ast).toBeCloseTo(6);
    expect(result!.to).toBeCloseTo(2);
    expect(result!.stl).toBeCloseTo(2);
    expect(result!.blk).toBeCloseTo(0);
    expect(result!.pf).toBeCloseTo(4);
  });
});
