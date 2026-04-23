export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type DominantHand = 'L' | 'R';
export type PlayerStatus = 'active' | 'hidden' | 'injured' | 'transferred';

export interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: Position | null;
  heightCm: number | null;
  weightKg: number | null;
  birthDate: Date | null;
  nationality: string | null;
  dominantHand: DominantHand | null;
  photo: string | null;
  status: PlayerStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OpponentPlayer {
  id: string;
  opponentTeamId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string | null;
  heightCm: number | null;
  weightKg: number | null;
  photo: string | null;
  notes: string | null;
}
