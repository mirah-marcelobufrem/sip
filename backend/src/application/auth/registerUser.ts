import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { IUserRepository } from '../../domain/repositories/user.repository.js';
import type { ISettingsRepository } from '../settings/settings.repository.js';

export const RegisterUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

export type RegisterUserInput = z.infer<typeof RegisterUserInput>;

export async function registerUser(
  input: RegisterUserInput,
  userRepo: IUserRepository,
  settingsRepo: ISettingsRepository,
) {
  const existing = await userRepo.findByEmail(input.email);
  if (existing) {
    throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_TAKEN' });
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await userRepo.create({
    email: input.email.toLowerCase(),
    passwordHash,
    displayName: input.displayName,
    avatarUrl: null,
  });

  await settingsRepo.create(user.id);

  return user;
}
