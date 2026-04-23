export interface BracketSlot {
  round: number;
  position: number;
  homeSeed: number | null;
  awaySeed: number | null;
}

export interface StandingsRow {
  seed: number;
  teamName: string;
  teamId?: string;
  wins: number;
  losses: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface GameResult {
  homeSeed: number;
  awaySeed: number;
  homeScore: number;
  awayScore: number;
}

/**
 * Generate single-elimination bracket slots for N teams.
 * Seeds are paired 1v(N), 2v(N-1)... in round 1.
 * Returns TBD slots for subsequent rounds.
 */
export function generateSingleElimination(numTeams: number): BracketSlot[] {
  const rounds = Math.ceil(Math.log2(numTeams));
  const firstRoundSlots = Math.pow(2, rounds);
  const slots: BracketSlot[] = [];

  // Round 1 — pair seeds
  for (let pos = 0; pos < firstRoundSlots / 2; pos++) {
    const homeSeed = pos + 1;
    const awaySeed = firstRoundSlots - pos;
    slots.push({
      round: 1,
      position: pos,
      homeSeed: homeSeed <= numTeams ? homeSeed : null,
      awaySeed: awaySeed <= numTeams ? awaySeed : null,
    });
  }

  // Subsequent rounds — TBD
  for (let round = 2; round <= rounds; round++) {
    const matchupsInRound = Math.pow(2, rounds - round);
    for (let pos = 0; pos < matchupsInRound; pos++) {
      slots.push({ round, position: pos, homeSeed: null, awaySeed: null });
    }
  }

  return slots;
}

/**
 * Generate double-elimination bracket slots.
 * Returns winners bracket + losers bracket slots.
 */
export function generateDoubleElimination(numTeams: number): BracketSlot[] {
  const rounds = Math.ceil(Math.log2(numTeams));
  const firstRoundSize = Math.pow(2, rounds);
  const slots: BracketSlot[] = [];

  // Winners bracket
  for (let pos = 0; pos < firstRoundSize / 2; pos++) {
    const homeSeed = pos + 1;
    const awaySeed = firstRoundSize - pos;
    slots.push({
      round: 1,
      position: pos,
      homeSeed: homeSeed <= numTeams ? homeSeed : null,
      awaySeed: awaySeed <= numTeams ? awaySeed : null,
    });
  }

  // Subsequent winners bracket rounds
  for (let round = 2; round <= rounds; round++) {
    const matchups = Math.pow(2, rounds - round);
    for (let pos = 0; pos < matchups; pos++) {
      slots.push({ round, position: pos, homeSeed: null, awaySeed: null });
    }
  }

  // Losers bracket rounds (numbered as negative rounds conceptually; stored as rounds > max)
  const lbRounds = (rounds - 1) * 2;
  for (let round = 1; round <= lbRounds; round++) {
    const matchups = Math.max(1, Math.pow(2, rounds - 1 - Math.floor(round / 2)));
    for (let pos = 0; pos < matchups; pos++) {
      slots.push({ round: rounds + round, position: pos, homeSeed: null, awaySeed: null });
    }
  }

  // Grand final
  slots.push({ round: rounds + lbRounds + 1, position: 0, homeSeed: null, awaySeed: null });

  return slots;
}

/**
 * Generate round-robin slots where each team plays every other team once.
 */
export function generateRoundRobin(numTeams: number): BracketSlot[] {
  const slots: BracketSlot[] = [];
  let round = 1;

  // Circle method for even/odd number of teams
  const teams = numTeams % 2 === 0 ? numTeams : numTeams + 1;
  const fixed = 1;

  for (let r = 0; r < teams - 1; r++) {
    let pos = 0;
    for (let i = 0; i < teams / 2; i++) {
      const home = i === 0 ? fixed : ((r + i - 1) % (teams - 1)) + 2;
      const away = ((r - i + teams - 1) % (teams - 1)) + 2;
      if (home <= numTeams && away <= numTeams) {
        slots.push({ round, position: pos++, homeSeed: home, awaySeed: away });
      }
    }
    round++;
  }

  return slots;
}

/**
 * Calculate round-robin standings from completed game results.
 */
export function calculateStandings(
  teams: Array<{ seed: number; teamName: string; teamId?: string }>,
  results: GameResult[],
): StandingsRow[] {
  const map = new Map<number, StandingsRow>();

  for (const t of teams) {
    map.set(t.seed, {
      seed: t.seed,
      teamName: t.teamName,
      teamId: t.teamId,
      wins: 0,
      losses: 0,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  for (const r of results) {
    const home = map.get(r.homeSeed);
    const away = map.get(r.awaySeed);
    if (!home || !away) continue;

    home.pointsFor += r.homeScore;
    home.pointsAgainst += r.awayScore;
    away.pointsFor += r.awayScore;
    away.pointsAgainst += r.homeScore;

    if (r.homeScore > r.awayScore) {
      home.wins += 1;
      home.points += 2;
      away.losses += 1;
    } else if (r.awayScore > r.homeScore) {
      away.wins += 1;
      away.points += 2;
      home.losses += 1;
    } else {
      home.points += 1;
      away.points += 1;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aPD = a.pointsFor - a.pointsAgainst;
    const bPD = b.pointsFor - b.pointsAgainst;
    return bPD - aPD;
  });
}
