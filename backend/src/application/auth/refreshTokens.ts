import type { IUserRepository, IRefreshTokenRepository } from '../../domain/repositories/user.repository.js';
import { generateTokens } from '../../infrastructure/auth/jwt.js';
import { hashToken } from '../../infrastructure/auth/token-hash.js';

export async function refreshTokens(
  refreshToken: string,
  userRepo: IUserRepository,
  refreshTokenRepo: IRefreshTokenRepository,
) {
  const tokenHash = await hashToken(refreshToken);
  const stored = await refreshTokenRepo.findValid(tokenHash);
  if (!stored) {
    throw Object.assign(new Error('Invalid refresh token'), { code: 'INVALID_TOKEN' });
  }

  await refreshTokenRepo.revoke(tokenHash);

  const user = await userRepo.findById(stored.userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { code: 'USER_NOT_FOUND' });
  }

  return generateTokens(user.id, refreshTokenRepo);
}
