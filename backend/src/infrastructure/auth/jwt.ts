import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';
import type { IRefreshTokenRepository } from '../../domain/repositories/user.repository.js';
import { hashToken } from './token-hash.js';

const accessSecret = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret-change-me');
const accessExpiry = process.env.JWT_EXPIRY ?? '15m';

export async function generateTokens(
  userId: string,
  refreshTokenRepo: IRefreshTokenRepository,
) {
  const accessToken = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(accessExpiry)
    .setIssuedAt()
    .sign(accessSecret);

  const rawRefreshToken = randomBytes(48).toString('hex');
  const tokenHash = await hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await refreshTokenRepo.create(userId, tokenHash, expiresAt);

  return { accessToken, refreshToken: rawRefreshToken };
}

export async function verifyAccessToken(token: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, accessSecret);
  return { sub: payload.sub as string };
}
