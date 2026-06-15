import express, { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzlePlayerRepository } from '../../infrastructure/database/repositories/player.repository.js';
import { DrizzleRosterRepository } from '../../infrastructure/database/repositories/roster.repository.js';
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
    // U-04 — keep the default "Full Squad" roster in sync with the roster list.
    const rosterRepo = new DrizzleRosterRepository(db);
    const def = await rosterRepo.findOrCreateDefaultForTeam(req.params.teamId);
    await rosterRepo.addPlayer(def.id, player.id);
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

const VALID_POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;

router.post('/import', express.text({ type: ['text/csv', 'text/plain'] }), async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const csvText = req.body as string;
    const lines = csvText.trim().split('\n').filter(Boolean);
    if (lines.length < 2) {
      res.status(400).json({ error: 'CSV must have a header row and at least one data row', code: 'VALIDATION_ERROR' }); return;
    }
    const headers = lines[0]!.split(',').map((h) => h.trim().replace(/"/g, ''));
    const db = getDb();
    const repo = new DrizzlePlayerRepository(db);
    const rosterRepo = new DrizzleRosterRepository(db);
    const defaultRoster = await rosterRepo.findOrCreateDefaultForTeam(req.params.teamId);
    let imported = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i]!.split(',').map((v) => v.trim().replace(/"/g, ''));
      const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx] ?? '']));
      if (!row['firstName'] || !row['lastName']) {
        errors.push(`Row ${i + 1}: missing firstName or lastName`);
        continue;
      }
      const pos = row['position'] ?? '';
      const created = await repo.create({
        teamId: req.params.teamId,
        firstName: row['firstName'],
        lastName: row['lastName'],
        jerseyNumber: row['jerseyNumber'] ? parseInt(row['jerseyNumber']) : undefined,
        position: (VALID_POSITIONS as readonly string[]).includes(pos) ? pos as typeof VALID_POSITIONS[number] : undefined,
        heightCm: row['heightCm'] ? parseFloat(row['heightCm']) : undefined,
        weightKg: row['weightKg'] ? parseFloat(row['weightKg']) : undefined,
        nationality: row['nationality'] || undefined,
        dominantHand: row['dominantHand'] === 'L' || row['dominantHand'] === 'R' ? row['dominantHand'] : undefined,
        notes: row['notes'] || undefined,
        status: 'active',
      });
      await rosterRepo.addPlayer(defaultRoster.id, created.id);
      imported++;
    }
    res.json({ imported, skipped: errors.length, errors });
  } catch (err) { next(err); }
});

export default router;
