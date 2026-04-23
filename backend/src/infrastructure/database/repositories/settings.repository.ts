import { eq } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { settings } from '../schema/settings.schema.js';
import type { ISettingsRepository } from '../../../application/settings/settings.repository.js';

export class DrizzleSettingsRepository implements ISettingsRepository {
  constructor(private db: Db) {}

  async create(userId: string): Promise<void> {
    await this.db.insert(settings).values({ userId, preferences: {} });
  }

  async findByUser(userId: string): Promise<Record<string, unknown>> {
    const rows = await this.db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))
      .limit(1);
    return (rows[0]?.preferences ?? {}) as Record<string, unknown>;
  }

  async update(userId: string, preferences: Record<string, unknown>): Promise<void> {
    await this.db
      .insert(settings)
      .values({ userId, preferences })
      .onConflictDoUpdate({ target: settings.userId, set: { preferences, updatedAt: new Date() } });
  }
}
