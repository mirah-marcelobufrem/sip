import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleUserRepository } from '../../infrastructure/database/repositories/user.repository.js';
import { DrizzleRefreshTokenRepository } from '../../infrastructure/database/repositories/refresh-token.repository.js';
import { DrizzleSettingsRepository } from '../../infrastructure/database/repositories/settings.repository.js';
import { registerUser, RegisterUserInput } from '../../application/auth/registerUser.js';
import { loginUser, LoginUserInput } from '../../application/auth/loginUser.js';
import { refreshTokens } from '../../application/auth/refreshTokens.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { hashToken } from '../../infrastructure/auth/token-hash.js';
import { users } from '../../infrastructure/database/schema/users.schema.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const input = RegisterUserInput.parse(req.body);
    const db = getDb();
    const user = await registerUser(
      input,
      new DrizzleUserRepository(db),
      new DrizzleSettingsRepository(db),
    );
    res.status(201).json({ id: user.id, email: user.email, displayName: user.displayName });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const input = LoginUserInput.parse(req.body);
    const db = getDb();
    const { user, tokens } = await loginUser(
      input,
      new DrizzleUserRepository(db),
      new DrizzleRefreshTokenRepository(db),
    );
    res.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl },
      tokens,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken required', code: 'VALIDATION_ERROR' });
      return;
    }
    const db = getDb();
    const tokens = await refreshTokens(
      refreshToken,
      new DrizzleUserRepository(db),
      new DrizzleRefreshTokenRepository(db),
    );
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const db = getDb();
      const repo = new DrizzleRefreshTokenRepository(db);
      const tokenHash = await hashToken(refreshToken);
      await repo.revoke(tokenHash);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const db = getDb();
    const user = await new DrizzleUserRepository(db).findById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }
    res.json({ id: user.id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: 'email required', code: 'VALIDATION_ERROR' }); return;
    }
    const db = getDb();
    const rows = await db.select().from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    if (rows.length > 0) {
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await db.update(users).set({
        resetToken: tokenHash,
        resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }).where(eq(users.email, email));
      console.log(`Password reset token for ${email}: ${token}`);
    }
    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) { next(err); }
});

router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword) {
      res.status(400).json({ error: 'token and newPassword required', code: 'VALIDATION_ERROR' }); return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'newPassword must be at least 8 characters', code: 'VALIDATION_ERROR' }); return;
    }
    const db = getDb();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const rows = await db.select().from(users)
      .where(and(
        eq(users.resetToken, tokenHash),
        gt(users.resetTokenExpiresAt, new Date()),
        isNull(users.deletedAt),
      ))
      .limit(1);
    if (rows.length === 0) {
      throw Object.assign(new Error('Invalid or expired reset token'), { code: 'INVALID_TOKEN' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({
      passwordHash,
      resetToken: null,
      resetTokenExpiresAt: null,
      updatedAt: new Date(),
    }).where(eq(users.id, rows[0]!.id));
    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
});

export default router;
