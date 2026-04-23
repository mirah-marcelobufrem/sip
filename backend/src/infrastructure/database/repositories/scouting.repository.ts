import { and, eq, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { Db } from '../connection.js';
import { scoutingReports } from '../schema/scouting.schema.js';

export type ScoutingReportRow = typeof scoutingReports.$inferSelect;
export type NewScoutingReport = typeof scoutingReports.$inferInsert;

export class DrizzleScoutingReportRepository {
  constructor(private db: Db) {}

  async findByUser(userId: string): Promise<ScoutingReportRow[]> {
    return this.db
      .select()
      .from(scoutingReports)
      .where(and(eq(scoutingReports.authorUserId, userId), isNull(scoutingReports.deletedAt)));
  }

  async findById(id: string): Promise<ScoutingReportRow | null> {
    const rows = await this.db
      .select()
      .from(scoutingReports)
      .where(and(eq(scoutingReports.id, id), isNull(scoutingReports.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByShareToken(token: string): Promise<ScoutingReportRow | null> {
    const rows = await this.db
      .select()
      .from(scoutingReports)
      .where(and(eq(scoutingReports.shareToken, token), isNull(scoutingReports.deletedAt)))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(data: Omit<NewScoutingReport, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScoutingReportRow> {
    const rows = await this.db.insert(scoutingReports).values(data).returning();
    return rows[0]!;
  }

  async update(id: string, data: Partial<ScoutingReportRow>): Promise<ScoutingReportRow> {
    const rows = await this.db
      .update(scoutingReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scoutingReports.id, id))
      .returning();
    return rows[0]!;
  }

  async generateShareToken(id: string): Promise<string> {
    const token = randomBytes(16).toString('hex');
    await this.db
      .update(scoutingReports)
      .set({ shareToken: token, visibility: 'link', updatedAt: new Date() })
      .where(eq(scoutingReports.id, id));
    return token;
  }

  async revokeShare(id: string): Promise<void> {
    await this.db
      .update(scoutingReports)
      .set({ shareToken: null, visibility: 'private', updatedAt: new Date() })
      .where(eq(scoutingReports.id, id));
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(scoutingReports)
      .set({ deletedAt: new Date() })
      .where(eq(scoutingReports.id, id));
  }
}
