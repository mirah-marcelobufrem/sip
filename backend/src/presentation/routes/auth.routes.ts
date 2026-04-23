import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleUserRepository } from '../../infrastructure/database/repositories/user.repository.js';
import { DrizzleRefreshTokenRepository } from '../../infrastructure/database/repositories/refresh-token.repository.js';
import { DrizzleSettingsRepository } from '../../infrastructure/database/repositories/settings.repository.js';
import { registerUser, RegisterUserInput } from '../../application/auth/registerUser.js';
import { loginUser, LoginUserInput } from '../../application/auth/loginUser.js';
import { refreshTokens } from '../../application/auth/refreshTokens.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { hashToken } from '../../infrastructure/auth/token-hash.js';

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

export default router;
