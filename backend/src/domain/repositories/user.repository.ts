import type { Invitation, User, UserTeamRole, TeamRole } from '../entities/user.entity.js';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;
}

export interface IUserTeamRoleRepository {
  findByUserAndTeam(userId: string, teamId: string): Promise<UserTeamRole | null>;
  findByTeam(teamId: string): Promise<(UserTeamRole & { user: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl'> })[]>;
  findByUser(userId: string): Promise<UserTeamRole[]>;
  upsert(data: UserTeamRole): Promise<UserTeamRole>;
  delete(userId: string, teamId: string): Promise<void>;
}

export interface IInvitationRepository {
  findByToken(token: string): Promise<Invitation | null>;
  findByTeamAndEmail(teamId: string, email: string): Promise<Invitation | null>;
  create(data: Omit<Invitation, 'id'>): Promise<Invitation>;
  accept(id: string): Promise<void>;
  deleteExpired(): Promise<void>;
}

export interface IRefreshTokenRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findValid(tokenHash: string): Promise<{ userId: string } | null>;
  revoke(tokenHash: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
