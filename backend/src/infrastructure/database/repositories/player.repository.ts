import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { players } from '../schema/players.schema.js';
import { opponentTeams, opponentPlayers } from '../schema/opponents.schema.js';

export interface IPlayerRepository {
  findById(id: string): Promise<typeof players.$inferSelect | null>;
  findByTeam(teamId: string): Promise<typeof players.$inferSelect[]>;
  create(data: typeof players.$inferInsert): Promise<typeof players.$inferSelect>;
  update(id: string, data: Partial<typeof players.$inferInsert>): Promise<typeof players.$inferSelect>;
  softDelete(id: string): Promise<void>;
}

export interface IOpponentTeamRepository {
  findById(id: string): Promise<typeof opponentTeams.$inferSelect | null>;
  findAll(): Promise<typeof opponentTeams.$inferSelect[]>;
  create(data: typeof opponentTeams.$inferInsert): Promise<typeof opponentTeams.$inferSelect>;
  update(id: string, data: Partial<typeof opponentTeams.$inferInsert>): Promise<typeof opponentTeams.$inferSelect>;
  softDelete(id: string): Promise<void>;
}

export interface IOpponentPlayerRepository {
  findByTeam(opponentTeamId: string): Promise<typeof opponentPlayers.$inferSelect[]>;
  create(data: typeof opponentPlayers.$inferInsert): Promise<typeof opponentPlayers.$inferSelect>;
  update(id: string, data: Partial<typeof opponentPlayers.$inferInsert>): Promise<typeof opponentPlayers.$inferSelect>;
  softDelete(id: string): Promise<void>;
}

export class DrizzlePlayerRepository implements IPlayerRepository {
  constructor(private db: Db) {}

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(players)
      .where(and(eq(players.id, id), isNull(players.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByTeam(teamId: string) {
    return this.db
      .select()
      .from(players)
      .where(and(eq(players.teamId, teamId), isNull(players.deletedAt)))
      .orderBy(players.jerseyNumber, players.lastName);
  }

  async create(data: typeof players.$inferInsert) {
    const rows = await this.db.insert(players).values(data).returning();
    return rows[0]!;
  }

  async update(id: string, data: Partial<typeof players.$inferInsert>) {
    const rows = await this.db
      .update(players)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(players.id, id))
      .returning();
    return rows[0]!;
  }

  async softDelete(id: string) {
    await this.db.update(players).set({ deletedAt: new Date() }).where(eq(players.id, id));
  }
}

export class DrizzleOpponentTeamRepository implements IOpponentTeamRepository {
  constructor(private db: Db) {}

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.id, id), isNull(opponentTeams.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findAll() {
    return this.db.select().from(opponentTeams).where(isNull(opponentTeams.deletedAt));
  }

  async create(data: typeof opponentTeams.$inferInsert) {
    const rows = await this.db.insert(opponentTeams).values(data).returning();
    return rows[0]!;
  }

  async update(id: string, data: Partial<typeof opponentTeams.$inferInsert>) {
    const rows = await this.db
      .update(opponentTeams)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(opponentTeams.id, id))
      .returning();
    return rows[0]!;
  }

  async softDelete(id: string) {
    await this.db.update(opponentTeams).set({ deletedAt: new Date() }).where(eq(opponentTeams.id, id));
  }
}

export class DrizzleOpponentPlayerRepository implements IOpponentPlayerRepository {
  constructor(private db: Db) {}

  async findByTeam(opponentTeamId: string) {
    return this.db
      .select()
      .from(opponentPlayers)
      .where(and(eq(opponentPlayers.opponentTeamId, opponentTeamId), isNull(opponentPlayers.deletedAt)));
  }

  async create(data: typeof opponentPlayers.$inferInsert) {
    const rows = await this.db.insert(opponentPlayers).values(data).returning();
    return rows[0]!;
  }

  async update(id: string, data: Partial<typeof opponentPlayers.$inferInsert>) {
    const rows = await this.db
      .update(opponentPlayers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(opponentPlayers.id, id))
      .returning();
    return rows[0]!;
  }

  async softDelete(id: string) {
    await this.db.update(opponentPlayers).set({ deletedAt: new Date() }).where(eq(opponentPlayers.id, id));
  }
}
