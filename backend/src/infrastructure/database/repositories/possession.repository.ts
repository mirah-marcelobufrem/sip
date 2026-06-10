import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { possessionSequences } from '../schema/possessions.schema.js';
import type { IPossessionSequenceRepository } from '../../../domain/repositories/possession.repository.js';
import type { PossessionSequence } from '../../../domain/entities/game.entity.js';

export class DrizzlePossessionSequenceRepository implements IPossessionSequenceRepository {
  constructor(private db: Db) {}

  async create(data: Omit<PossessionSequence, 'id' | 'createdAt'>): Promise<PossessionSequence> {
    const rows = await this.db.insert(possessionSequences).values(data).returning();
    return this.toEntity(rows[0]!);
  }

  async closeSequence(gameId: string, endActionId: string): Promise<void> {
    await this.db
      .update(possessionSequences)
      .set({ endActionId })
      .where(
        and(
          eq(possessionSequences.gameId, gameId),
          isNull(possessionSequences.endActionId),
        ),
      );
  }

  async findByGame(gameId: string): Promise<PossessionSequence[]> {
    const rows = await this.db
      .select()
      .from(possessionSequences)
      .where(eq(possessionSequences.gameId, gameId))
      .orderBy(asc(possessionSequences.createdAt));
    return rows.map(this.toEntity);
  }

  private toEntity(row: typeof possessionSequences.$inferSelect): PossessionSequence {
    return {
      id: row.id,
      gameId: row.gameId,
      period: row.period,
      clockTimeSeconds: row.clockTimeSeconds,
      teamId: row.teamId,
      startActionId: row.startActionId,
      endActionId: row.endActionId,
      isOffensiveReboundContinuation: row.isOffensiveReboundContinuation,
      createdAt: row.createdAt,
    };
  }
}
