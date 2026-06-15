import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleRosterRepository } from '../../infrastructure/database/repositories/roster.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { createRoster } from '../../application/rosters/createRoster.js';
import { addPlayerToRoster } from '../../application/rosters/addPlayerToRoster.js';
import { assertPlayersBelongToTeam } from '../../application/rosters/eligibility.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

const SetPlayersBody = z.object({ playerIds: z.array(z.string().uuid()) });
const AddPlayerBody = z.object({ playerId: z.string().uuid() });
const UpdateRosterBody = z.object({
  name: z.string().min(1).max(120).optional(),
  seasonLabel: z.string().max(120).nullable().optional(),
  isDefault: z.boolean().optional(),
});

router.get('/', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const db = getDb();
    const rosters = await new DrizzleRosterRepository(db).findByTeam(req.params.teamId);
    res.json(rosters);
  } catch (err) { next(err); }
});

router.post('/', async (req: Request<{ teamId: string }>, res, next) => {
  try {
    const db = getDb();
    const roster = await createRoster(
      { ...req.body, teamId: req.params.teamId },
      new DrizzleRosterRepository(db),
    );
    res.status(201).json(roster);
  } catch (err) { next(err); }
});

router.get('/:rosterId', async (req: Request<{ teamId: string; rosterId: string }>, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleRosterRepository(db);
    const roster = await repo.findById(req.params.rosterId);
    if (!roster || roster.teamId !== req.params.teamId) {
      res.status(404).json({ error: 'Roster not found', code: 'NOT_FOUND' }); return;
    }
    res.json({ ...roster, playerIds: await repo.getPlayerIds(roster.id) });
  } catch (err) { next(err); }
});

router.put('/:rosterId', async (req: Request<{ teamId: string; rosterId: string }>, res, next) => {
  try {
    const body = UpdateRosterBody.parse(req.body);
    const db = getDb();
    const repo = new DrizzleRosterRepository(db);
    const existing = await repo.findById(req.params.rosterId);
    if (!existing || existing.teamId !== req.params.teamId) {
      res.status(404).json({ error: 'Roster not found', code: 'NOT_FOUND' }); return;
    }
    const roster = await repo.update(req.params.rosterId, body);
    res.json(roster);
  } catch (err) { next(err); }
});

router.delete('/:rosterId', async (req: Request<{ teamId: string; rosterId: string }>, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleRosterRepository(db);
    const existing = await repo.findById(req.params.rosterId);
    if (!existing || existing.teamId !== req.params.teamId) {
      res.status(404).json({ error: 'Roster not found', code: 'NOT_FOUND' }); return;
    }
    await repo.softDelete(req.params.rosterId);
    res.status(204).send();
  } catch (err) { next(err); }
});

// Replace the full player set (R6 enforced for every player).
router.put('/:rosterId/players', async (req: Request<{ teamId: string; rosterId: string }>, res, next) => {
  try {
    const { playerIds } = SetPlayersBody.parse(req.body);
    const db = getDb();
    const repo = new DrizzleRosterRepository(db);
    const roster = await repo.findById(req.params.rosterId);
    if (!roster || roster.teamId !== req.params.teamId) {
      res.status(404).json({ error: 'Roster not found', code: 'NOT_FOUND' }); return;
    }
    await assertPlayersBelongToTeam(playerIds, roster.teamId, repo);
    await repo.setPlayers(req.params.rosterId, playerIds);
    res.json({ ...roster, playerIds });
  } catch (err) { next(err); }
});

router.post('/:rosterId/players', async (req: Request<{ teamId: string; rosterId: string }>, res, next) => {
  try {
    const { playerId } = AddPlayerBody.parse(req.body);
    const db = getDb();
    await addPlayerToRoster(
      { rosterId: req.params.rosterId, playerId, teamId: req.params.teamId },
      new DrizzleRosterRepository(db),
    );
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/:rosterId/players/:playerId', async (req: Request<{ teamId: string; rosterId: string; playerId: string }>, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleRosterRepository(db);
    const roster = await repo.findById(req.params.rosterId);
    if (!roster || roster.teamId !== req.params.teamId) {
      res.status(404).json({ error: 'Roster not found', code: 'NOT_FOUND' }); return;
    }
    await repo.removePlayer(req.params.rosterId, req.params.playerId);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
