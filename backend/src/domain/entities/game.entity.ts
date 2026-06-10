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

export type LinkRole =
  | 'rebound_after_miss'
  | 'assist_after_made'
  | 'turnover_after_steal'
  | 'foul_drawn'
  | 'ft_for_foul'
  | 'to_after_offensive_foul'
  | 'wave_sub_member';

export interface PossessionState {
  teamId: string | null;
  arrowTeamId: string | null;
  isPending: boolean; // true when waiting for rebound after last FT miss
}

export interface PossessionSequence {
  id: string;
  gameId: string;
  period: number;
  clockTimeSeconds: number;
  teamId: string;
  startActionId: string | null;
  endActionId: string | null;
  isOffensiveReboundContinuation: boolean;
  createdAt: Date;
}

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
  currentPossessionTeamId: string | null;
  possessionArrowTeamId: string | null;
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
  seq: number | null;
  linkedActionId: string | null;
  linkRole: LinkRole | null;
  waveSubGroupId: string | null;
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
