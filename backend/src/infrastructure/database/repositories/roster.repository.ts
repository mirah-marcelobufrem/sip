import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { players } from '../schema/players.schema.js';
import { rosterPlayers, rosters } from '../schema/rosters.schema.js';

export type RosterWithPlayerIds = typeof rosters.$inferSelect & { playerIds: string[] };

export interface IRosterRepository {
  findById(id: string): Promise<typeof rosters.$inferSelect | null>;
  findByTeam(teamId: string): Promise<RosterWithPlayerIds[]>;
  findDefaultForTeam(teamId: string): Promise<typeof rosters.$inferSelect | null>;
  /** Find-or-create the team's default "Full Squad" roster (mirrors findOrCreateFriendlyForTeam). */
  findOrCreateDefaultForTeam(teamId: string): Promise<typeof rosters.$inferSelect>;
  getPlayerIds(rosterId: string): Promise<string[]>;
  create(data: typeof rosters.$inferInsert): Promise<typeof rosters.$inferSelect>;
  update(id: string, data: Partial<typeof rosters.$inferInsert>): Promise<typeof rosters.$inferSelect>;
  softDelete(id: string): Promise<void>;
  addPlayer(rosterId: string, playerId: string): Promise<void>;
  removePlayer(rosterId: string, playerId: string): Promise<void>;
  setPlayers(rosterId: string, playerIds: string[]): Promise<void>;
  /** R6 helper — the team a player belongs to (null if not found / soft-deleted). */
  getPlayerTeamId(playerId: string): Promise<string | null>;
}

export class DrizzleRosterRepository implements IRosterRepository {
  constructor(private db: Db) {}

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(rosters)
      .where(and(eq(rosters.id, id), isNull(rosters.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByTeam(teamId: string): Promise<RosterWithPlayerIds[]> {
    const rosterRows = await this.db
      .select()
      .from(rosters)
      .where(and(eq(rosters.teamId, teamId), isNull(rosters.deletedAt)));
    if (rosterRows.length === 0) return [];
    const rosterIds = rosterRows.map((r) => r.id);
    const links = await this.db
      .select()
      .from(rosterPlayers)
      .where(inArray(rosterPlayers.rosterId, rosterIds));
    return rosterRows.map((r) => ({
      ...r,
      playerIds: links.filter((l) => l.rosterId === r.id).map((l) => l.playerId),
    }));
  }

  async findDefaultForTeam(teamId: string) {
    const rows = await this.db
      .select()
      .from(rosters)
      .where(and(eq(rosters.teamId, teamId), eq(rosters.isDefault, true), isNull(rosters.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findOrCreateDefaultForTeam(teamId: string) {
    const existing = await this.findDefaultForTeam(teamId);
    if (existing) return existing;
    const rows = await this.db
      .insert(rosters)
      .values({ teamId, name: 'Full Squad', isDefault: true })
      .returning();
    return rows[0]!;
  }

  async getPlayerIds(rosterId: string) {
    const links = await this.db
      .select({ playerId: rosterPlayers.playerId })
      .from(rosterPlayers)
      .where(eq(rosterPlayers.rosterId, rosterId));
    return links.map((l) => l.playerId);
  }

  async create(data: typeof rosters.$inferInsert) {
    const rows = await this.db.insert(rosters).values(data).returning();
    return rows[0]!;
  }

  async update(id: string, data: Partial<typeof rosters.$inferInsert>) {
    const rows = await this.db
      .update(rosters)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rosters.id, id))
      .returning();
    return rows[0]!;
  }

  async softDelete(id: string) {
    await this.db.update(rosters).set({ deletedAt: new Date() }).where(eq(rosters.id, id));
  }

  async addPlayer(rosterId: string, playerId: string) {
    await this.db
      .insert(rosterPlayers)
      .values({ rosterId, playerId })
      .onConflictDoNothing({ target: [rosterPlayers.rosterId, rosterPlayers.playerId] });
  }

  async removePlayer(rosterId: string, playerId: string) {
    await this.db
      .delete(rosterPlayers)
      .where(and(eq(rosterPlayers.rosterId, rosterId), eq(rosterPlayers.playerId, playerId)));
  }

  async setPlayers(rosterId: string, playerIds: string[]) {
    await this.db.delete(rosterPlayers).where(eq(rosterPlayers.rosterId, rosterId));
    if (playerIds.length === 0) return;
    await this.db
      .insert(rosterPlayers)
      .values(playerIds.map((playerId) => ({ rosterId, playerId })))
      .onConflictDoNothing({ target: [rosterPlayers.rosterId, rosterPlayers.playerId] });
  }

  async getPlayerTeamId(playerId: string) {
    const rows = await this.db
      .select({ teamId: players.teamId })
      .from(players)
      .where(and(eq(players.id, playerId), isNull(players.deletedAt)))
      .limit(1);
    return rows[0]?.teamId ?? null;
  }
}
