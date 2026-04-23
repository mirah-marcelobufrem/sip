export interface ISettingsRepository {
  create(userId: string): Promise<void>;
  findByUser(userId: string): Promise<Record<string, unknown>>;
  update(userId: string, preferences: Record<string, unknown>): Promise<void>;
}
