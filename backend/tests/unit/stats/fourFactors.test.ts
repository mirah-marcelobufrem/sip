import { computeFourFactors } from '../../../src/domain/stat-calculators.js';

describe('computeFourFactors (N-03, Dean Oliver four factors)', () => {
  it('computes all four factors from true-attempt totals', () => {
    const ff = computeFourFactors({
      fgm: 10,
      threePm: 2,
      fga: 20,
      to: 5,
      fta: 10,
      oreb: 8,
      oppDreb: 24,
    });

    expect(ff.efgPct).toBeCloseTo((10 + 0.5 * 2) / 20, 10); // 0.55
    expect(ff.tovPct).toBeCloseTo(5 / (20 + 0.44 * 10 + 5), 10);
    expect(ff.orebPct).toBeCloseTo(8 / (8 + 24), 10); // 0.25
    expect(ff.ftRate).toBeCloseTo(10 / 20, 10); // 0.5
  });

  it('returns null for eFG% and FT rate when there are no field goal attempts', () => {
    const ff = computeFourFactors({ fgm: 0, threePm: 0, fga: 0, to: 3, fta: 4, oreb: 2, oppDreb: 5 });
    expect(ff.efgPct).toBeNull();
    expect(ff.ftRate).toBeNull();
    // TOV% denominator is still positive (0 + 1.76 + 3)
    expect(ff.tovPct).toBeCloseTo(3 / (0.44 * 4 + 3), 10);
  });

  it('returns null TOV% when the possession denominator is zero', () => {
    const ff = computeFourFactors({ fgm: 0, threePm: 0, fga: 0, to: 0, fta: 0, oreb: 1, oppDreb: 1 });
    expect(ff.tovPct).toBeNull();
  });

  it('returns null ORB% when neither side has rebounds', () => {
    const ff = computeFourFactors({ fgm: 1, threePm: 0, fga: 2, to: 1, fta: 0, oreb: 0, oppDreb: 0 });
    expect(ff.orebPct).toBeNull();
  });

  it('returns all nulls on a completely empty stat line', () => {
    const ff = computeFourFactors({ fgm: 0, threePm: 0, fga: 0, to: 0, fta: 0, oreb: 0, oppDreb: 0 });
    expect(ff).toEqual({ efgPct: null, tovPct: null, orebPct: null, ftRate: null });
  });
});
