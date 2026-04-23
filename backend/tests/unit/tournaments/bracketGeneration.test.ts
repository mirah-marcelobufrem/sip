import {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  calculateStandings,
  type GameResult,
} from '../../../src/domain/tournament-bracket.js';

describe('generateSingleElimination', () => {
  it('generates correct number of slots for 8 teams', () => {
    const slots = generateSingleElimination(8);
    // 4 + 2 + 1 = 7 total slots
    expect(slots).toHaveLength(7);
    expect(slots.filter((s) => s.round === 1)).toHaveLength(4);
    expect(slots.filter((s) => s.round === 2)).toHaveLength(2);
    expect(slots.filter((s) => s.round === 3)).toHaveLength(1);
  });

  it('pairs seed 1 vs seed 8 in round 1 for 8-team bracket', () => {
    const slots = generateSingleElimination(8);
    const r1 = slots.filter((s) => s.round === 1);
    const firstMatch = r1[0]!;
    expect(firstMatch.homeSeed).toBe(1);
    expect(firstMatch.awaySeed).toBe(8);
  });

  it('pairs seed 2 vs seed 7 in round 1 for 8-team bracket', () => {
    const slots = generateSingleElimination(8);
    const r1 = slots.filter((s) => s.round === 1);
    expect(r1[1]!.homeSeed).toBe(2);
    expect(r1[1]!.awaySeed).toBe(7);
  });

  it('subsequent rounds have null seeds (TBD)', () => {
    const slots = generateSingleElimination(8);
    const laterRounds = slots.filter((s) => s.round > 1);
    expect(laterRounds.every((s) => s.homeSeed === null && s.awaySeed === null)).toBe(true);
  });

  it('handles 4 teams correctly', () => {
    const slots = generateSingleElimination(4);
    expect(slots).toHaveLength(3); // 2 + 1
    expect(slots.filter((s) => s.round === 1)).toHaveLength(2);
  });

  it('handles 2 teams (final only)', () => {
    const slots = generateSingleElimination(2);
    expect(slots).toHaveLength(1);
    expect(slots[0]!.homeSeed).toBe(1);
    expect(slots[0]!.awaySeed).toBe(2);
  });

  it('handles non-power-of-2 team count (e.g. 6)', () => {
    const slots = generateSingleElimination(6);
    // Rounds to next power of 2 = 8; slots where seed > 6 become null
    const r1 = slots.filter((s) => s.round === 1);
    // Seeds 7 and 8 don't exist, so those positions should be null
    expect(r1.some((s) => s.homeSeed === null || s.awaySeed === null)).toBe(true);
  });
});

describe('generateRoundRobin', () => {
  it('generates correct number of rounds for 4 teams', () => {
    const slots = generateRoundRobin(4);
    const rounds = new Set(slots.map((s) => s.round));
    expect(rounds.size).toBe(3); // 4-1 = 3 rounds
  });

  it('each team plays exactly N-1 games in a 4-team round-robin', () => {
    const slots = generateRoundRobin(4);
    const counts = new Map<number, number>();
    for (const s of slots) {
      if (s.homeSeed !== null) counts.set(s.homeSeed, (counts.get(s.homeSeed) ?? 0) + 1);
      if (s.awaySeed !== null) counts.set(s.awaySeed, (counts.get(s.awaySeed) ?? 0) + 1);
    }
    for (const [, count] of counts) {
      expect(count).toBe(3);
    }
  });

  it('generates unique matchups (no team plays itself)', () => {
    const slots = generateRoundRobin(6);
    for (const s of slots) {
      expect(s.homeSeed).not.toBe(s.awaySeed);
    }
  });
});

describe('generateDoubleElimination', () => {
  it('generates more rounds than single elimination', () => {
    const single = generateSingleElimination(8);
    const double = generateDoubleElimination(8);
    const singleMax = Math.max(...single.map((s) => s.round));
    const doubleMax = Math.max(...double.map((s) => s.round));
    expect(doubleMax).toBeGreaterThan(singleMax);
  });

  it('includes a grand final slot', () => {
    const slots = generateDoubleElimination(8);
    const maxRound = Math.max(...slots.map((s) => s.round));
    const finals = slots.filter((s) => s.round === maxRound);
    expect(finals).toHaveLength(1);
  });
});

describe('calculateStandings', () => {
  const teams = [
    { seed: 1, teamName: 'Alpha' },
    { seed: 2, teamName: 'Beta' },
    { seed: 3, teamName: 'Gamma' },
    { seed: 4, teamName: 'Delta' },
  ];

  it('sorts by points descending', () => {
    const results: GameResult[] = [
      { homeSeed: 1, awaySeed: 2, homeScore: 80, awayScore: 70 }, // Alpha wins
      { homeSeed: 1, awaySeed: 3, homeScore: 75, awayScore: 60 }, // Alpha wins
      { homeSeed: 2, awaySeed: 3, homeScore: 65, awayScore: 55 }, // Beta wins
    ];
    const standings = calculateStandings(teams, results);
    expect(standings[0]!.teamName).toBe('Alpha'); // 4 pts
    expect(standings[0]!.points).toBe(4);
    expect(standings[1]!.teamName).toBe('Beta');  // 2 pts
    expect(standings[3]!.wins).toBe(0);
  });

  it('ties broken by point differential', () => {
    const results: GameResult[] = [
      { homeSeed: 1, awaySeed: 2, homeScore: 100, awayScore: 50 }, // Alpha +50
      { homeSeed: 3, awaySeed: 4, homeScore: 80, awayScore: 78 }, // Gamma +2
    ];
    const standings = calculateStandings(teams, results);
    // Alpha and Gamma both have 2 pts; Alpha has +50, Gamma has +2
    expect(standings[0]!.teamName).toBe('Alpha');
    expect(standings[1]!.teamName).toBe('Gamma');
  });

  it('accumulates points for and against correctly', () => {
    const results: GameResult[] = [
      { homeSeed: 1, awaySeed: 2, homeScore: 90, awayScore: 80 },
    ];
    const standings = calculateStandings(teams, results);
    const alpha = standings.find((s) => s.teamName === 'Alpha')!;
    const beta = standings.find((s) => s.teamName === 'Beta')!;
    expect(alpha.pointsFor).toBe(90);
    expect(alpha.pointsAgainst).toBe(80);
    expect(beta.pointsFor).toBe(80);
    expect(beta.pointsAgainst).toBe(90);
  });

  it('handles empty results returning all teams with 0 wins', () => {
    const standings = calculateStandings(teams, []);
    expect(standings).toHaveLength(4);
    expect(standings.every((s) => s.wins === 0 && s.losses === 0)).toBe(true);
  });
});
