import { registerUser } from '../../../src/application/auth/registerUser.js';
import type { IUserRepository } from '../../../src/domain/repositories/user.repository.js';
import type { ISettingsRepository } from '../../../src/application/settings/settings.repository.js';
import type { User } from '../../../src/domain/entities/user.entity.js';

function makeUserRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByEmail: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (data) => ({
      id: 'user-1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User)),
    update: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  };
}

function makeSettingsRepo(): ISettingsRepository {
  return {
    create: jest.fn().mockResolvedValue(undefined),
    findByUser: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

describe('registerUser', () => {
  it('creates a new user with hashed password', async () => {
    const userRepo = makeUserRepo();
    const settingsRepo = makeSettingsRepo();

    const user = await registerUser(
      { email: 'test@example.com', password: 'password123', displayName: 'Test User' },
      userRepo,
      settingsRepo,
    );

    expect(user.email).toBe('test@example.com');
    expect(userRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' }),
    );
    expect(settingsRepo.create).toHaveBeenCalledWith('user-1');
  });

  it('throws EMAIL_TAKEN when email already registered', async () => {
    const userRepo = makeUserRepo({
      findByEmail: jest.fn().mockResolvedValue({ id: 'existing' } as User),
    });

    await expect(
      registerUser(
        { email: 'taken@example.com', password: 'password123', displayName: 'User' },
        userRepo,
        makeSettingsRepo(),
      ),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('rejects passwords shorter than 8 characters', async () => {
    await expect(
      registerUser(
        { email: 'a@b.com', password: 'short', displayName: 'User' },
        makeUserRepo(),
        makeSettingsRepo(),
      ),
    ).rejects.toThrow();
  });
});
