import { and, eq, desc } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { lineupSnapshots } from '../schema/lineup-snapshots.schema.js';
import type { ILineupSnapshotRepository } from '../../../domain/repositories/game.repository.js';
import type { LineupSnapshot } from '../../../domain/entities/game.entity.js';

export class DrizzleLineupSnapshotRepository implements ILineupSnapshotRepository {
  constructor(private db: Db) {}

  async findByGame(gameId: string): Promise<LineupSnapshot[]> {
    const rows = await this.db
      .select()
      .from(lineupSnapshots)
      .where(eq(lineupSnapshots.gameId, gameId))
      .orderBy(lineupSnapshots.period, lineupSnapshots.clockTimeSeconds);
    return rows.map(this.toEntity);
  }

  async findLatestByGameAndTeam(gameId: string, teamId: string): Promise<LineupSnapshot | null> {
    if (!teamId) return null;
    const rows = await this.db
      .select()
      .from(lineupSnapshots)
      .where(and(eq(lineupSnapshots.gameId, gameId), eq(lineupSnapshots.teamId, teamId)))
      .orderBy(desc(lineupSnapshots.createdAt))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async create(data: Omit<LineupSnapshot, 'id'>): Promise<LineupSnapshot> {
    const rows = await this.db.insert(lineupSnapshots).values(data).returning();
    return this.toEntity(rows[0]!);
  }

  async update(id: string, data: Partial<LineupSnapshot>): Promise<LineupSnapshot> {
    const rows = await this.db
      .update(lineupSnapshots)
      .set(data)
      .where(eq(lineupSnapshots.id, id))
      .returning();
    return this.toEntity(rows[0]!);
  }

  private toEntity(row: typeof lineupSnapshots.$inferSelect): LineupSnapshot {
    return {
      id: row.id,
      gameId: row.gameId,
      teamId: row.teamId,
      period: row.period,
      clockTimeSeconds: row.clockTimeSeconds,
      playerIds: row.playerIds,
    };
  }
}
