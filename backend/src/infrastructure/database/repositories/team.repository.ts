import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { teams } from '../schema/teams.schema.js';
import { userTeamRoles } from '../schema/users.schema.js';
import { users } from '../schema/users.schema.js';

export interface ITeamRepository {
  findById(id: string): Promise<typeof teams.$inferSelect | null>;
  findByUser(userId: string): Promise<typeof teams.$inferSelect[]>;
  /** U-01 — external (scouted) teams owned by the user. */
  findExternalByUser(userId: string): Promise<typeof teams.$inferSelect[]>;
  /** U-02 — find-or-create an external team by name for a user (mirrors findOrCreateFriendlyForTeam). */
  findOrCreateExternalByName(name: string, userId: string): Promise<typeof teams.$inferSelect>;
  create(data: typeof teams.$inferInsert): Promise<typeof teams.$inferSelect>;
  update(id: string, data: Partial<typeof teams.$inferInsert>): Promise<typeof teams.$inferSelect>;
  softDelete(id: string): Promise<void>;
}

export interface IUserTeamRoleRepository {
  findByUserAndTeam(userId: string, teamId: string): Promise<typeof userTeamRoles.$inferSelect | null>;
  findByTeam(teamId: string): Promise<(typeof userTeamRoles.$inferSelect & { user: Pick<typeof users.$inferSelect, 'id' | 'email' | 'displayName' | 'avatarUrl'> })[]>;
  upsert(userId: string, teamId: string, role: typeof userTeamRoles.$inferSelect['role']): Promise<void>;
  delete(userId: string, teamId: string): Promise<void>;
}

export class DrizzleTeamRepository implements ITeamRepository {
  constructor(private db: Db) {}

  async findById(id: string) {
    const rows = await this.db.select().from(teams).where(and(eq(teams.id, id), isNull(teams.deletedAt))).limit(1);
    return rows[0] ?? null;
  }

  async findByUser(userId: string) {
    const roles = await this.db
      .select({ teamId: userTeamRoles.teamId })
      .from(userTeamRoles)
      .where(eq(userTeamRoles.userId, userId));
    const teamIds = roles.map((r) => r.teamId);
    if (teamIds.length === 0) return [];
    const result = await this.db
      .select()
      .from(teams)
      .where(and(eq(teams.kind, 'managed'), isNull(teams.deletedAt)));
    return result.filter((t) => teamIds.includes(t.id));
  }

  async findExternalByUser(userId: string) {
    return this.db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.kind, 'external'),
          eq(teams.createdByUserId, userId),
          isNull(teams.deletedAt),
        ),
      );
  }

  async findOrCreateExternalByName(name: string, userId: string) {
    const trimmed = name.trim();
    const existing = await this.db
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.kind, 'external'),
          eq(teams.createdByUserId, userId),
          eq(teams.name, trimmed),
          isNull(teams.deletedAt),
        ),
      )
      .limit(1);
    if (existing[0]) return existing[0];
    const rows = await this.db
      .insert(teams)
      .values({ name: trimmed, kind: 'external', createdByUserId: userId })
      .returning();
    return rows[0]!;
  }

  async create(data: typeof teams.$inferInsert) {
    const rows = await this.db.insert(teams).values(data).returning();
    return rows[0]!;
  }

  async update(id: string, data: Partial<typeof teams.$inferInsert>) {
    const rows = await this.db
      .update(teams)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();
    return rows[0]!;
  }

  async softDelete(id: string) {
    await this.db.update(teams).set({ deletedAt: new Date() }).where(eq(teams.id, id));
  }
}

export class DrizzleUserTeamRoleRepository implements IUserTeamRoleRepository {
  constructor(private db: Db) {}

  async findByUserAndTeam(userId: string, teamId: string) {
    const rows = await this.db
      .select()
      .from(userTeamRoles)
      .where(and(eq(userTeamRoles.userId, userId), eq(userTeamRoles.teamId, teamId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByTeam(teamId: string) {
    const rows = await this.db
      .select({
        role: userTeamRoles,
        user: { id: users.id, email: users.email, displayName: users.displayName, avatarUrl: users.avatarUrl },
      })
      .from(userTeamRoles)
      .innerJoin(users, eq(userTeamRoles.userId, users.id))
      .where(eq(userTeamRoles.teamId, teamId));
    return rows.map((r) => ({ ...r.role, user: r.user }));
  }

  async upsert(userId: string, teamId: string, role: typeof userTeamRoles.$inferSelect['role']) {
    await this.db
      .insert(userTeamRoles)
      .values({ userId, teamId, role })
      .onConflictDoUpdate({ target: [userTeamRoles.userId, userTeamRoles.teamId], set: { role } });
  }

  async delete(userId: string, teamId: string) {
    await this.db
      .delete(userTeamRoles)
      .where(and(eq(userTeamRoles.userId, userId), eq(userTeamRoles.teamId, teamId)));
  }
}
