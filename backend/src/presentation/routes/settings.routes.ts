import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleSettingsRepository } from '../../infrastructure/database/repositories/settings.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

const PreferencesSchema = z.object({
  language: z.enum(['pt', 'en']).optional(),
  units: z.enum(['metric', 'imperial']).optional(),
  defaultGameFormat: z.enum(['quarters', 'halves']).optional(),
  defaultPeriodDuration: z.number().int().min(5).max(60).optional(),
  defaultFoulLimit: z.number().int().min(1).max(10).optional(),
  playerSortOrder: z.enum(['jersey', 'lastName']).optional(),
  showAdvancedStats: z.boolean().optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  boxScoreColumns: z.record(z.boolean()).optional(),
  shotChartPrompt: z.enum(['always', 'timed', 'never']).optional(),
  opponentTrackingMode: z.enum(['individual', 'team', 'off']).optional(),
  simplifiedMode: z.boolean().optional(),
  foulTroubleThreshold: z.number().int().min(1).max(6).optional(),
  scoringRunAlertThreshold: z.number().int().min(3).max(20).optional(),
  notificationsEnabled: z.record(z.boolean()).optional(),
  primaryTeamColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryTeamColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    const repo = new DrizzleSettingsRepository(getDb());
    const preferences = await repo.findByUser(req.userId);
    res.json({ preferences });
  } catch (err) {
    next(err);
  }
});

router.put('/', authenticate, async (req, res, next) => {
  try {
    const parsed = PreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid preferences', details: parsed.error.flatten() });
    }
    const repo = new DrizzleSettingsRepository(getDb());
    const current = await repo.findByUser(req.userId);
    await repo.update(req.userId, { ...current, ...parsed.data });
    const updated = await repo.findByUser(req.userId);
    res.json({ preferences: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
