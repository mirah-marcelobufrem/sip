export type TeamRole = 'OWNER' | 'COACH' | 'ASSISTANT' | 'SCOUT' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTeamRole {
  userId: string;
  teamId: string;
  role: TeamRole;
}

export interface Invitation {
  id: string;
  token: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedByUserId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
}
