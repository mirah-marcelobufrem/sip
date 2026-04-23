import { useEffect, useRef } from 'react';

export type AlertLevel = 'info' | 'warning' | 'danger';

export type GameAlert = {
  id: string;
  level: AlertLevel;
  message: string;
};

export type GameState = {
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

export function detectAlerts(state: GameState): GameAlert[] {
  const alerts: GameAlert[] = [];

  if (state.homeTeamFouls >= state.foulLimit) {
    alerts.push({ id: `bonus-home`, level: 'danger', message: `${state.homeTeamName} is in BONUS (${state.homeTeamFouls} team fouls)` });
  }
  if (state.awayTeamFouls >= state.foulLimit) {
    alerts.push({ id: `bonus-away`, level: 'danger', message: `${state.awayTeamName} is in BONUS (${state.awayTeamFouls} team fouls)` });
  }

  for (const player of state.homePlayers) {
    if (player.fouls >= state.foulTroubleThreshold) {
      alerts.push({ id: `foul-${player.name}`, level: 'warning', message: `${player.name} is in foul trouble (${player.fouls} PF)` });
    }
  }
  for (const player of state.awayPlayers) {
    if (player.fouls >= state.foulTroubleThreshold) {
      alerts.push({ id: `foul-${player.name}`, level: 'warning', message: `${player.name} is in foul trouble (${player.fouls} PF)` });
    }
  }

  const run = detectScoringRun(state.recentScoring, state.scoringRunThreshold);
  if (run) {
    alerts.push({ id: 'scoring-run', level: 'warning', message: run });
  }

  return alerts;
}

function detectScoringRun(
  recentScoring: Array<{ teamId: 'home' | 'away'; points: number }>,
  threshold: number,
): string | null {
  if (recentScoring.length < 2) return null;

  let runTeam: 'home' | 'away' | null = null;
  let runPoints = 0;

  for (const event of [...recentScoring].reverse()) {
    if (runTeam === null) {
      runTeam = event.teamId;
      runPoints = event.points;
    } else if (event.teamId === runTeam) {
      runPoints += event.points;
    } else {
      break;
    }
  }

  if (runTeam && runPoints >= threshold) {
    return `${runTeam === 'home' ? 'Home' : 'Away'} is on a ${runPoints}-0 run!`;
  }
  return null;
}

export function useGameAlertPoller(
  getState: () => GameState | null,
  onAlert: (alert: GameAlert) => void,
  intervalMs = 3000,
) {
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    const timer = setInterval(() => {
      const state = getState();
      if (!state) return;
      const alerts = detectAlerts(state);
      for (const alert of alerts) {
        if (!seenIds.current.has(alert.id)) {
          seenIds.current.add(alert.id);
          onAlert(alert);
        }
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [getState, onAlert, intervalMs]);

  function clearSeen() { seenIds.current.clear(); }
  return { clearSeen };
}
