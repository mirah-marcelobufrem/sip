import { eq, isNull } from 'drizzle-orm';
import type { Db } from '../connection.js';
import { users } from '../schema/users.schema.js';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { User } from '../../../domain/entities/user.entity.js';

export class DrizzleUserRepository implements IUserRepository {
  constructor(private db: Db) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return rows[0] ? this.toEntity(rows[0]) : null;
  }

  async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const rows = await this.db
      .insert(users)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
      })
      .returning();
    return this.toEntity(rows[0]!);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const rows = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return this.toEntity(rows[0]!);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ deletedAt: new Date() })
      .where(eq(users.id, id));
  }

  private toEntity(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
