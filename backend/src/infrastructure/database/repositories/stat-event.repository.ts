import { and, asc, eq, isNull, inArray, sql } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { statEvents } from '../schema/stat-events.schema.js';
import type { IStatEventRepository } from '../../../domain/repositories/game.repository.js';
import type { StatEvent, StatType } from '../../../domain/entities/game.entity.js';

export class DrizzleStatEventRepository implements IStatEventRepository {
  constructor(private db: Db) {}

  async findById(id: string): Promise<StatEvent | null> {
    const rows = await this.db
      .select()
      .from(statEvents)
      .where(and(eq(statEvents.id, id), isNull(statEvents.deletedAt)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByGame(gameId: string): Promise<StatEvent[]> {
    const rows = await this.db
      .select()
      .from(statEvents)
      .where(and(eq(statEvents.gameId, gameId), isNull(statEvents.deletedAt)))
      .orderBy(
        asc(statEvents.period),
        sql`COALESCE(${statEvents.seq}, EXTRACT(EPOCH FROM ${statEvents.createdAt}) * 1000) ASC`,
        asc(statEvents.createdAt),
      );
    return rows.map(this.toEntity);
  }

  async findByGameAndPeriod(gameId: string, period: number): Promise<StatEvent[]> {
    const rows = await this.db
      .select()
      .from(statEvents)
      .where(
        and(
          eq(statEvents.gameId, gameId),
          eq(statEvents.period, period),
          isNull(statEvents.deletedAt),
        ),
      )
      .orderBy(sql`${statEvents.seq} ASC NULLS LAST`, asc(statEvents.createdAt));
    return rows.map(this.toEntity);
  }

  async findByGameAndPlayer(gameId: string, playerId: string): Promise<StatEvent[]> {
    const rows = await this.db
      .select()
      .from(statEvents)
      .where(
        and(
          eq(statEvents.gameId, gameId),
          eq(statEvents.playerId, playerId),
          isNull(statEvents.deletedAt),
        ),
      );
    return rows.map(this.toEntity);
  }

  async findByPlayer(playerId: string): Promise<StatEvent[]> {
    const rows = await this.db
      .select()
      .from(statEvents)
      .where(and(eq(statEvents.playerId, playerId), isNull(statEvents.deletedAt)));
    return rows.map(this.toEntity);
  }

  async findByGameAndTeam(gameId: string, teamId: string): Promise<StatEvent[]> {
    const rows = await this.db
      .select()
      .from(statEvents)
      .where(
        and(
          eq(statEvents.gameId, gameId),
          eq(statEvents.teamId, teamId),
          isNull(statEvents.deletedAt),
        ),
      );
    return rows.map(this.toEntity);
  }

  async findShotEvents(filters: {
    playerId?: string;
    teamId?: string;
    gameId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<StatEvent[]> {
    const shotTypes: StatType[] = ['2PM', '2PA', '3PM', '3PA'];
    const conditions = [
      isNull(statEvents.deletedAt),
      inArray(statEvents.statType, shotTypes),
    ];

    if (filters.playerId) conditions.push(eq(statEvents.playerId, filters.playerId));
    if (filters.teamId) conditions.push(eq(statEvents.teamId, filters.teamId));
    if (filters.gameId) conditions.push(eq(statEvents.gameId, filters.gameId));

    const rows = await this.db
      .select()
      .from(statEvents)
      .where(and(...conditions));
    return rows.map(this.toEntity);
  }

  async create(data: Omit<StatEvent, 'id' | 'createdAt'>): Promise<StatEvent> {
    const rows = await this.db.insert(statEvents).values(data).returning();
    return this.toEntity(rows[0]!);
  }

  async createBatch(events: Omit<StatEvent, 'id' | 'createdAt'>[]): Promise<StatEvent[]> {
    if (events.length === 0) return [];
    const rows = await this.db.insert(statEvents).values(events).returning();
    return rows.map(this.toEntity);
  }

  async update(id: string, data: Partial<StatEvent>): Promise<StatEvent> {
    const rows = await this.db
      .update(statEvents)
      .set(data)
      .where(eq(statEvents.id, id))
      .returning();
    return this.toEntity(rows[0]!);
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(statEvents)
      .set({ deletedAt: new Date() })
      .where(eq(statEvents.id, id));
  }

  private toEntity(row: typeof statEvents.$inferSelect): StatEvent {
    return {
      id: row.id,
      gameId: row.gameId,
      period: row.period,
      clockTimeSeconds: row.clockTimeSeconds,
      playerId: row.playerId,
      teamId: row.teamId,
      statType: row.statType as StatEvent['statType'],
      value: row.value,
      xCourt: row.xCourt,
      yCourt: row.yCourt,
      lineupSnapshotId: row.lineupSnapshotId,
      seq: row.seq,
      createdAt: row.createdAt,
    };
  }
}
