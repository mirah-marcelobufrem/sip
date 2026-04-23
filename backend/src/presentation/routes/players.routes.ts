import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzlePlayerRepository } from '../../infrastructure/database/repositories/player.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

const PlayerBody = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  jerseyNumber: z.number().int().min(0).max(99).optional(),
  position: z.enum(['PG', 'SG', 'SF', 'PF', 'C']).optional(),
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional(),
  nationality: z.string().optional(),
  dominantHand: z.enum(['L', 'R']).optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'hidden', 'injured', 'transferred']).optional(),
});

router.get('/', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const db = getDb();
    const players = await new DrizzlePlayerRepository(db).findByTeam(req.params.teamId);
    res.json(players);
  } catch (err) { next(err); }
});

router.post('/', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const body = PlayerBody.parse(req.body);
    const db = getDb();
    const player = await new DrizzlePlayerRepository(db).create({
      ...body,
      teamId: req.params.teamId,
      status: body.status ?? 'active',
    });
    res.status(201).json(player);
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request<{ teamId: string; id: string }>, res, next) => {
  try {
    const db = getDb();
    const player = await new DrizzlePlayerRepository(db).findById(req.params.id);
    if (!player || player.teamId !== req.params.teamId) {
      res.status(404).json({ error: 'Player not found', code: 'NOT_FOUND' }); return;
    }
    res.json(player);
  } catch (err) { next(err); }
});

router.put('/:id', async (req: Request<{ teamId: string; id: string }>, res, next) => {
  try {
    const body = PlayerBody.partial().parse(req.body);
    const db = getDb();
    const player = await new DrizzlePlayerRepository(db).update(req.params.id, body);
    res.json(player);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request<{ teamId: string; id: string }>, res, next) => {
  try {
    const db = getDb();
    await new DrizzlePlayerRepository(db).softDelete(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
