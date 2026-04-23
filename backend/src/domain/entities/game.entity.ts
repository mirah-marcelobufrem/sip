export type GameFormat = 'quarters' | 'halves';
export type GameStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';
export type StatType =
  | '2PM' | '2PA' | '3PM' | '3PA' | 'FTM' | 'FTA'
  | 'OREB' | 'DREB'
  | 'AST' | 'TO'
  | 'STL' | 'BLK' | 'DFD'
  | 'PF' | 'TF' | 'FF'
  | 'SUB_IN' | 'SUB_OUT'
  | 'PERIOD_START' | 'PERIOD_END'
  | 'TIMEOUT';

export interface Game {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeOpponentTeamId: string | null;
  awayOpponentTeamId: string | null;
  date: Date;
  location: string | null;
  format: GameFormat;
  numPeriods: number;
  periodDurationMinutes: number;
  foulLimitBonus: number;
  threePointEnabled: boolean;
  currentPeriod: number;
  status: GameStatus;
  finalScoreHome: number | null;
  finalScoreAway: number | null;
  notes: string | null;
}

export interface StatEvent {
  id: string;
  gameId: string;
  period: number;
  clockTimeSeconds: number | null;
  playerId: string | null;
  teamId: string | null;
  statType: StatType;
  value: number;
  xCourt: number | null;
  yCourt: number | null;
  lineupSnapshotId: string | null;
  createdAt: Date;
}

export interface LineupSnapshot {
  id: string;
  gameId: string;
  teamId: string;
  period: number;
  clockTimeSeconds: number | null;
  playerIds: string[];
}
