import { and, eq, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { Db } from '../connection.js';
import { tournaments, tournamentGames } from '../schema/tournaments.schema.js';
import type { Tournament, TournamentGame, TournamentTeamEntry } from '../schema/tournaments.schema.js';

export { Tournament, TournamentGame, TournamentTeamEntry };

export interface TournamentGameRow {
  id: string;
  tournamentId: string;
  round: number;
  position: number;
  homeSeed: number | null;
  awaySeed: number | null;
  gameId: string | null;
  createdAt: Date;
}

export class DrizzleTournamentRepository {
  constructor(private db: Db) {}

  async findAll(): Promise<Tournament[]> {
    return this.db
      .select()
      .from(tournaments)
      .where(isNull(tournaments.deletedAt))
      .orderBy(tournaments.createdAt);
  }

  async findById(id: string): Promise<Tournament | null> {
    const rows = await this.db
      .select()
      .from(tournaments)
      .where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByShareToken(token: string): Promise<Tournament | null> {
    const rows = await this.db
      .select()
      .from(tournaments)
      .where(and(eq(tournaments.shareToken, token), isNull(tournaments.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: {
    name: string;
    format: Tournament['format'];
    numTeams: number;
    teams: TournamentTeamEntry[];
    startDate?: Date;
    endDate?: Date;
    organizationId?: string;
  }): Promise<Tournament> {
    const rows = await this.db
      .insert(tournaments)
      .values({
        name: data.name,
        format: data.format,
        numTeams: data.numTeams,
        teams: data.teams,
        startDate: data.startDate,
        endDate: data.endDate,
        organizationId: data.organizationId,
      })
      .returning();
    return rows[0]!;
  }

  async update(id: string, data: Partial<{
    name: string;
    status: Tournament['status'];
    teams: TournamentTeamEntry[];
    startDate: Date;
    endDate: Date;
  }>): Promise<Tournament> {
    const rows = await this.db
      .update(tournaments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tournaments.id, id))
      .returning();
    return rows[0]!;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(tournaments)
      .set({ deletedAt: new Date() })
      .where(eq(tournaments.id, id));
  }

  async generateShareToken(id: string): Promise<string> {
    const token = randomBytes(16).toString('hex');
    await this.db
      .update(tournaments)
      .set({ shareToken: token, updatedAt: new Date() })
      .where(eq(tournaments.id, id));
    return token;
  }

  async revokeShareToken(id: string): Promise<void> {
    await this.db
      .update(tournaments)
      .set({ shareToken: null, updatedAt: new Date() })
      .where(eq(tournaments.id, id));
  }

  // --- Bracket slots ---

  async getBracketSlots(tournamentId: string): Promise<TournamentGame[]> {
    return this.db
      .select()
      .from(tournamentGames)
      .where(eq(tournamentGames.tournamentId, tournamentId))
      .orderBy(tournamentGames.round, tournamentGames.position);
  }

  async insertBracketSlots(
    tournamentId: string,
    slots: Array<{ round: number; position: number; homeSeed: number | null; awaySeed: number | null }>,
  ): Promise<void> {
    if (slots.length === 0) return;
    await this.db.insert(tournamentGames).values(
      slots.map((s) => ({
        tournamentId,
        round: s.round,
        position: s.position,
        homeSeed: s.homeSeed,
        awaySeed: s.awaySeed,
      })),
    );
  }

  async updateBracketSlot(id: string, data: { gameId?: string; homeSeed?: number | null; awaySeed?: number | null }): Promise<void> {
    await this.db.update(tournamentGames).set(data).where(eq(tournamentGames.id, id));
  }
}
