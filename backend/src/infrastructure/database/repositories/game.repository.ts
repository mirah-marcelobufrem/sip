import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { games } from '../schema/games.schema.js';
import type { IGameRepository } from '../../../domain/repositories/game.repository.js';
import type { Game } from '../../../domain/entities/game.entity.js';

export class DrizzleGameRepository implements IGameRepository {
  constructor(private db: Db) {}

  async findById(id: string): Promise<Game | null> {
    const rows = await this.db
      .select()
      .from(games)
      .where(and(eq(games.id, id), isNull(games.deletedAt)))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByTeam(teamId: string, filters?: { status?: string; tournamentId?: string }): Promise<Game[]> {
    const rows = await this.db
      .select()
      .from(games)
      .where(isNull(games.deletedAt));
    return rows
      .filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId)
      .filter((g) => !filters?.status || g.status === filters.status)
      .filter((g) => !filters?.tournamentId || g.tournamentId === filters.tournamentId)
      .map(this.toEntity);
  }

  async create(data: Omit<Game, 'id'>): Promise<Game> {
    const rows = await this.db.insert(games).values({
      homeTeamId: data.homeTeamId,
      awayTeamId: data.awayTeamId,
      homeOpponentTeamId: data.homeOpponentTeamId,
      awayOpponentTeamId: data.awayOpponentTeamId,
      date: data.date,
      location: data.location,
      format: data.format,
      numPeriods: data.numPeriods,
      periodDurationMinutes: data.periodDurationMinutes,
      foulLimitBonus: data.foulLimitBonus,
      threePointEnabled: data.threePointEnabled ? 1 : 0,
      currentPeriod: data.currentPeriod,
      status: data.status,
      notes: data.notes,
      tournamentId: data.tournamentId,
    }).returning();
    return this.toEntity(rows[0]!);
  }

  async update(id: string, data: Partial<Game>): Promise<Game> {
    const { threePointEnabled, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest, updatedAt: new Date() };
    if (threePointEnabled !== undefined) updateData.threePointEnabled = threePointEnabled ? 1 : 0;
    const rows = await this.db
      .update(games)
      .set(updateData)
      .where(eq(games.id, id))
      .returning();
    return this.toEntity(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.db.update(games).set({ deletedAt: new Date() }).where(eq(games.id, id));
  }

  private toEntity(row: typeof games.$inferSelect): Game {
    return {
      id: row.id,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homeOpponentTeamId: row.homeOpponentTeamId,
      awayOpponentTeamId: row.awayOpponentTeamId,
      date: row.date,
      location: row.location,
      format: row.format as Game['format'],
      numPeriods: row.numPeriods,
      periodDurationMinutes: row.periodDurationMinutes,
      foulLimitBonus: row.foulLimitBonus,
      threePointEnabled: row.threePointEnabled === 1,
      currentPeriod: row.currentPeriod,
      status: row.status as Game['status'],
      finalScoreHome: row.finalScoreHome,
      finalScoreAway: row.finalScoreAway,
      notes: row.notes,
      currentPossessionTeamId: row.currentPossessionTeamId,
      possessionArrowTeamId: row.possessionArrowTeamId,
      tournamentId: row.tournamentId,
    };
  }
}
