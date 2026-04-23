// Tests for alert detection logic — mirrors the pure functions in frontend/src/hooks/useGameAlerts.ts

type GameState = {
  homeTeamName: string;
  awayTeamName: string;
  homeTeamFouls: number;
  awayTeamFouls: number;
  homePlayers: Array<{ name: string; fouls: number }>;
  awayPlayers: Array<{ name: string; fouls: number }>;
  recentScoring: Array<{ teamId: 'home' | 'away'; points: number }>;
  foulLimit: number;
  foulTroubleThreshold: number;
  scoringRunThreshold: number;
};

type AlertLevel = 'info' | 'warning' | 'danger';
type GameAlert = { id: string; level: AlertLevel; message: string };

function detectScoringRun(recentScoring: GameState['recentScoring'], threshold: number): string | null {
  if (recentScoring.length < 2) return null;
  let runTeam: 'home' | 'away' | null = null;
  let runPoints = 0;
  for (const event of [...recentScoring].reverse()) {
    if (runTeam === null) { runTeam = event.teamId; runPoints = event.points; }
    else if (event.teamId === runTeam) runPoints += event.points;
    else break;
  }
  if (runTeam && runPoints >= threshold) return `${runTeam === 'home' ? 'Home' : 'Away'} is on a ${runPoints}-0 run!`;
  return null;
}

function detectAlertsLocal(state: GameState): GameAlert[] {
  const alerts: GameAlert[] = [];
  if (state.homeTeamFouls >= state.foulLimit)
    alerts.push({ id: 'bonus-home', level: 'danger', message: `${state.homeTeamName} is in BONUS (${state.homeTeamFouls} team fouls)` });
  if (state.awayTeamFouls >= state.foulLimit)
    alerts.push({ id: 'bonus-away', level: 'danger', message: `${state.awayTeamName} is in BONUS (${state.awayTeamFouls} team fouls)` });
  for (const p of state.homePlayers)
    if (p.fouls >= state.foulTroubleThreshold)
      alerts.push({ id: `foul-${p.name}`, level: 'warning', message: `${p.name} is in foul trouble (${p.fouls} PF)` });
  for (const p of state.awayPlayers)
    if (p.fouls >= state.foulTroubleThreshold)
      alerts.push({ id: `foul-${p.name}`, level: 'warning', message: `${p.name} is in foul trouble (${p.fouls} PF)` });
  const run = detectScoringRun(state.recentScoring, state.scoringRunThreshold);
  if (run) alerts.push({ id: 'scoring-run', level: 'warning', message: run });
  return alerts;
}

const baseState: GameState = {
  homeTeamName: 'Home', awayTeamName: 'Away',
  homeTeamFouls: 0, awayTeamFouls: 0,
  homePlayers: [], awayPlayers: [],
  recentScoring: [],
  foulLimit: 5, foulTroubleThreshold: 3, scoringRunThreshold: 7,
};

describe('detectAlerts – team bonus', () => {
  it('triggers bonus alert when home reaches foul limit', () => {
    const alerts = detectAlertsLocal({ ...baseState, homeTeamFouls: 5 });
    expect(alerts.some((a) => a.id === 'bonus-home' && a.level === 'danger')).toBe(true);
  });

  it('no bonus alert below limit', () => {
    const alerts = detectAlertsLocal({ ...baseState, homeTeamFouls: 4 });
    expect(alerts.some((a) => a.id === 'bonus-home')).toBe(false);
  });
});

describe('detectAlerts – foul trouble', () => {
  it('triggers foul trouble for player at threshold', () => {
    const alerts = detectAlertsLocal({ ...baseState, homePlayers: [{ name: 'Jordan', fouls: 3 }] });
    expect(alerts.some((a) => a.id === 'foul-Jordan')).toBe(true);
  });

  it('no alert below threshold', () => {
    const alerts = detectAlertsLocal({ ...baseState, homePlayers: [{ name: 'Jordan', fouls: 2 }] });
    expect(alerts.some((a) => a.id === 'foul-Jordan')).toBe(false);
  });
});

describe('detectAlerts – scoring run', () => {
  it('detects a run at the threshold', () => {
    const scoring = [
      { teamId: 'home' as const, points: 2 },
      { teamId: 'away' as const, points: 3 },
      { teamId: 'away' as const, points: 2 },
      { teamId: 'away' as const, points: 2 },
    ];
    const alerts = detectAlertsLocal({ ...baseState, recentScoring: scoring, scoringRunThreshold: 7 });
    expect(alerts.some((a) => a.id === 'scoring-run')).toBe(true);
  });

  it('no run alert when points are split', () => {
    const scoring = [
      { teamId: 'home' as const, points: 3 },
      { teamId: 'away' as const, points: 3 },
      { teamId: 'home' as const, points: 2 },
    ];
    const alerts = detectAlertsLocal({ ...baseState, recentScoring: scoring });
    expect(alerts.some((a) => a.id === 'scoring-run')).toBe(false);
  });
});
