import {
  getFTCountForShootingFoul,
  isThreePointArea,
  isThreePointAreaCourt,
} from '../../../src/domain/stat-calculators.js';

// Two coordinate frames over the normalized 15m × 14m half-court:
// - SPEC frame (pure formula): baseline at y=1, basket at (0.5, 0.885)
// - STORAGE frame (xCourt/yCourt as stored/submitted): baseline at y=0,
//   basket at (0.5, 0.113) — mirror of the spec frame (yStorage = 1 - ySpec)

describe('isThreePointArea (pure spec-frame formula, basket at (0.5, 0.885))', () => {
  it('classifies a deep corner 3 at (0.05, 0.95) as 3pt (corner straight section)', () => {
    expect(isThreePointArea(0.05, 0.95)).toBe(true);
  });

  it('classifies the paint at (0.5, 0.8) as 2pt', () => {
    expect(isThreePointArea(0.5, 0.8)).toBe(false);
  });

  it('classifies the top of the arc at (0.5, 0.3) as 3pt', () => {
    expect(isThreePointArea(0.5, 0.3)).toBe(true);
  });
});

describe('isThreePointAreaCourt (STORAGE frame, basket at (0.5, 0.113))', () => {
  it('classifies a deep corner 3 at (0.05, 0.05) as 3pt (corner straight section)', () => {
    expect(isThreePointAreaCourt(0.05, 0.05)).toBe(true);
  });

  it('classifies the right corner at (0.95, 0.1) as 3pt regardless of distance', () => {
    expect(isThreePointAreaCourt(0.95, 0.1)).toBe(true);
  });

  it('classifies a paint shot near the basket at (0.5, 0.2) as 2pt', () => {
    expect(isThreePointAreaCourt(0.5, 0.2)).toBe(false);
  });

  it('classifies the top of the arc at (0.5, 0.7) as 3pt', () => {
    expect(isThreePointAreaCourt(0.5, 0.7)).toBe(true);
  });

  it('classifies a mid-range shot just inside the arc as 2pt', () => {
    // straight above the basket: arc crosses yStorage = 0.113 + 6.75/14 ≈ 0.5971
    expect(isThreePointAreaCourt(0.5, 0.59)).toBe(false);
  });

  it('classifies a shot just beyond the arc as 3pt', () => {
    expect(isThreePointAreaCourt(0.5, 0.6)).toBe(true);
  });

  it('treats x = 0.085 as inside the corner boundary (2pt next to the basket)', () => {
    // exactly on the corner boundary falls through to the distance check;
    // (0.085, 0.115) is 6.225m from the basket → 2pt
    expect(isThreePointAreaCourt(0.085, 0.115)).toBe(false);
  });

  it('classifies x just below 0.085 as 3pt at any depth', () => {
    expect(isThreePointAreaCourt(0.084, 0.115)).toBe(true);
  });
});

describe('getFTCountForShootingFoul (STORAGE frame inputs)', () => {
  it('awards 3 FTs for a foul on a 3pt attempt (deep corner)', () => {
    expect(getFTCountForShootingFoul(0.05, 0.05)).toBe(3);
  });

  it('awards 3 FTs for a foul at the top of the arc', () => {
    expect(getFTCountForShootingFoul(0.5, 0.7)).toBe(3);
  });

  it('awards 2 FTs for a foul in the paint near the basket', () => {
    expect(getFTCountForShootingFoul(0.5, 0.2)).toBe(2);
  });
});
