import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { IUserRepository, IRefreshTokenRepository } from '../../domain/repositories/user.repository.js';
import { generateTokens } from '../../infrastructure/auth/jwt.js';

export const LoginUserInput = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type LoginUserInput = z.infer<typeof LoginUserInput>;

export async function loginUser(
  input: LoginUserInput,
  userRepo: IUserRepository,
  refreshTokenRepo: IRefreshTokenRepository,
) {
  const user = await userRepo.findByEmail(input.email.toLowerCase());
  if (!user || !user.passwordHash) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' });
  }

  const tokens = await generateTokens(user.id, refreshTokenRepo);

  return { user, tokens };
}
