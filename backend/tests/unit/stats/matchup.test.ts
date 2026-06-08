// Pure unit tests for matchup W/L detection and average score diff computation.
// These functions are extracted here for testing without Express or DB dependencies.

interface GameResult {
  teamScore: number;
  oppScore: number;
}

function classifyResult(teamScore: number, oppScore: number): 'W' | 'L' | 'T' {
  if (teamScore > oppScore) return 'W';
  if (teamScore < oppScore) return 'L';
  return 'T';
}

function computeMatchupSummary(results: GameResult[]): {
  wins: number;
  losses: number;
  avgScoreDiff: number;
  avgPts: number;
  avgOppPts: number;
} {
  let wins = 0;
  let losses = 0;
  let totalDiff = 0;
  let totalTeamPts = 0;
  let totalOppPts = 0;

  for (const r of results) {
    const result = classifyResult(r.teamScore, r.oppScore);
    if (result === 'W') wins++;
    else if (result === 'L') losses++;
    totalDiff += r.teamScore - r.oppScore;
    totalTeamPts += r.teamScore;
    totalOppPts += r.oppScore;
  }

  const count = results.length;
  return {
    wins,
    losses,
    avgScoreDiff: count > 0 ? totalDiff / count : 0,
    avgPts: count > 0 ? totalTeamPts / count : 0,
    avgOppPts: count > 0 ? totalOppPts / count : 0,
  };
}

describe('matchup win/loss detection', () => {
  it('classifies win when teamScore > oppScore', () => {
    expect(classifyResult(80, 70)).toBe('W');
  });

  it('classifies loss when teamScore < oppScore', () => {
    expect(classifyResult(60, 75)).toBe('L');
  });

  it('classifies tie when scores are equal', () => {
    expect(classifyResult(65, 65)).toBe('T');
  });
});

describe('computeMatchupSummary', () => {
  it('correctly counts wins and losses', () => {
    const results: GameResult[] = [
      { teamScore: 80, oppScore: 70 },
      { teamScore: 60, oppScore: 75 },
      { teamScore: 85, oppScore: 65 },
      { teamScore: 55, oppScore: 70 },
    ];
    const summary = computeMatchupSummary(results);
    expect(summary.wins).toBe(2);
    expect(summary.losses).toBe(2);
  });

  it('calculates correct avgScoreDiff', () => {
    const results: GameResult[] = [
      { teamScore: 80, oppScore: 70 }, // +10
      { teamScore: 60, oppScore: 75 }, // -15
      { teamScore: 85, oppScore: 65 }, // +20
      { teamScore: 55, oppScore: 70 }, // -15
    ];
    // diffs: 10, -15, 20, -15 → sum = 0 → avg = 0
    const summary = computeMatchupSummary(results);
    expect(summary.avgScoreDiff).toBeCloseTo(0);
  });

  it('calculates correct avgPts and avgOppPts', () => {
    const results: GameResult[] = [
      { teamScore: 70, oppScore: 60 },
      { teamScore: 80, oppScore: 70 },
    ];
    const summary = computeMatchupSummary(results);
    expect(summary.avgPts).toBeCloseTo(75);
    expect(summary.avgOppPts).toBeCloseTo(65);
  });

  it('returns zeros for empty results', () => {
    const summary = computeMatchupSummary([]);
    expect(summary.wins).toBe(0);
    expect(summary.losses).toBe(0);
    expect(summary.avgScoreDiff).toBe(0);
    expect(summary.avgPts).toBe(0);
    expect(summary.avgOppPts).toBe(0);
  });

  it('handles single game avgScoreDiff correctly', () => {
    const results: GameResult[] = [{ teamScore: 72, oppScore: 64 }];
    const summary = computeMatchupSummary(results);
    expect(summary.avgScoreDiff).toBeCloseTo(8);
    expect(summary.wins).toBe(1);
    expect(summary.losses).toBe(0);
  });
});
