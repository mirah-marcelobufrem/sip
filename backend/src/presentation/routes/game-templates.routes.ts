import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../../infrastructure/database/connection.js';
import { gameTemplates } from '../../infrastructure/database/schema/games.schema.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const templates = await db
      .select()
      .from(gameTemplates)
      .where(eq(gameTemplates.userId, req.userId));
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

const CreateTemplateBody = z.object({
  name: z.string().min(1),
  config: z.record(z.unknown()),
});

router.post('/', async (req, res, next) => {
  try {
    const body = CreateTemplateBody.parse(req.body);
    const db = getDb();
    const rows = await db
      .insert(gameTemplates)
      .values({
        userId: req.userId,
        name: body.name,
        config: body.config,
      })
      .returning();
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const existing = await db
      .select()
      .from(gameTemplates)
      .where(eq(gameTemplates.id, req.params.id))
      .limit(1);

    if (!existing[0] || existing[0].userId !== req.userId) {
      res.status(404).json({ error: 'Template not found', code: 'NOT_FOUND' });
      return;
    }

    await db.delete(gameTemplates).where(eq(gameTemplates.id, req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
