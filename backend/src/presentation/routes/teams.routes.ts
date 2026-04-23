import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleTeamRepository, DrizzleUserTeamRoleRepository } from '../../infrastructure/database/repositories/team.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

const CreateTeamBody = z.object({
  name: z.string().min(1).max(100),
  season: z.string().optional(),
  sportLevel: z.enum(['youth', 'high_school', 'college', 'pro', 'recreational']).optional(),
  homeCourt: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  organizationId: z.string().uuid().optional(),
});

router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const teams = await new DrizzleTeamRepository(db).findByUser(req.userId);
    res.json(teams);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const body = CreateTeamBody.parse(req.body);
    const db = getDb();
    const teamRepo = new DrizzleTeamRepository(db);
    const roleRepo = new DrizzleUserTeamRoleRepository(db);

    const team = await teamRepo.create({ ...body, active: true });
    await roleRepo.upsert(req.userId, team.id, 'OWNER');

    res.status(201).json(team);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const team = await new DrizzleTeamRepository(db).findById(req.params.id);
    if (!team) { res.status(404).json({ error: 'Team not found', code: 'NOT_FOUND' }); return; }
    res.json(team);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const body = CreateTeamBody.partial().parse(req.body);
    const db = getDb();
    const team = await new DrizzleTeamRepository(db).update(req.params.id, body);
    res.json(team);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    await new DrizzleTeamRepository(db).softDelete(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.get('/:id/members', async (req, res, next) => {
  try {
    const db = getDb();
    const members = await new DrizzleUserTeamRoleRepository(db).findByTeam(req.params.id);
    res.json(members);
  } catch (err) { next(err); }
});

export default router;
