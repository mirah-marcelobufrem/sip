import { eq, and, gt, isNull } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { refreshTokens } from '../schema/users.schema.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/user.repository.js';

export class DrizzleRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private db: Db) {}

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
  }

  async findValid(tokenHash: string): Promise<{ userId: string } | null> {
    const rows = await this.db
      .select({ userId: refreshTokens.userId })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }
}
