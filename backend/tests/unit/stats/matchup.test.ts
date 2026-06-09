import {
  classifyMatchupResult,
  computeMatchupSummary,
} from '../../../src/domain/stat-calculators.js';

describe('classifyMatchupResult', () => {
  it('returns W when teamScore > oppScore', () => {
    expect(classifyMatchupResult(80, 70)).toBe('W');
  });

  it('returns L when teamScore < oppScore', () => {
    expect(classifyMatchupResult(60, 75)).toBe('L');
  });

  it('returns T when scores are equal', () => {
    expect(classifyMatchupResult(65, 65)).toBe('T');
  });
});

describe('computeMatchupSummary', () => {
  it('counts wins and losses correctly', () => {
    const summary = computeMatchupSummary([
      { teamScore: 80, oppScore: 70 },
      { teamScore: 60, oppScore: 75 },
      { teamScore: 85, oppScore: 65 },
      { teamScore: 55, oppScore: 70 },
    ]);
    expect(summary.wins).toBe(2);
    expect(summary.losses).toBe(2);
  });

  it('calculates avgScoreDiff correctly', () => {
    // diffs: +10, -15, +20, -15 → sum = 0 → avg = 0
    const summary = computeMatchupSummary([
      { teamScore: 80, oppScore: 70 },
      { teamScore: 60, oppScore: 75 },
      { teamScore: 85, oppScore: 65 },
      { teamScore: 55, oppScore: 70 },
    ]);
    expect(summary.avgScoreDiff).toBeCloseTo(0);
  });

  it('calculates avgPts and avgOppPts correctly', () => {
    const summary = computeMatchupSummary([
      { teamScore: 70, oppScore: 60 },
      { teamScore: 80, oppScore: 70 },
    ]);
    expect(summary.avgPts).toBeCloseTo(75);
    expect(summary.avgOppPts).toBeCloseTo(65);
  });

  it('returns zeros for empty input', () => {
    const summary = computeMatchupSummary([]);
    expect(summary.wins).toBe(0);
    expect(summary.losses).toBe(0);
    expect(summary.avgScoreDiff).toBe(0);
    expect(summary.avgPts).toBe(0);
    expect(summary.avgOppPts).toBe(0);
  });

  it('handles single-game case correctly', () => {
    const summary = computeMatchupSummary([{ teamScore: 72, oppScore: 64 }]);
    expect(summary.avgScoreDiff).toBeCloseTo(8);
    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(0);
  });
});
