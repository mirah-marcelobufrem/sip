import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { pushSubscriptions } from '../schema/push-subscriptions.schema.js';

export class PushSubscriptionRepository {
  constructor(private db: Db) {}

  async save(userId: string, endpoint: string, p256dh: string, auth: string, userAgent?: string): Promise<void> {
    await this.db
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh, auth, userAgent })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh, auth, userAgent },
      });
  }

  async remove(userId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  }

  async findByUser(userId: string): Promise<Array<{ endpoint: string; p256dh: string; auth: string }>> {
    return this.db
      .select({ endpoint: pushSubscriptions.endpoint, p256dh: pushSubscriptions.p256dh, auth: pushSubscriptions.auth })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  }

  async removeAllForUser(userId: string): Promise<void> {
    await this.db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }
}
