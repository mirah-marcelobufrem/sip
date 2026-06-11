import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { eq, and, isNull, gt } from 'drizzle-orm';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleTeamRepository, DrizzleUserTeamRoleRepository } from '../../infrastructure/database/repositories/team.repository.js';
import { DrizzleTournamentRepository } from '../../infrastructure/database/repositories/tournament.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { invitations } from '../../infrastructure/database/schema/users.schema.js';

// Public invitation accept — mounted by index.ts before analyticsRoutes (blanket authenticate)
export function publicTeamsRouter(): Router {
  const pub = Router();
  pub.post('/invitations/accept', async (req, res, next) => {
    try {
      const { token, userId } = req.body as { token?: string; userId?: string };
      if (!token) {
        res.status(400).json({ error: 'token required', code: 'VALIDATION_ERROR' }); return;
      }
      const db = getDb();
      const rows = await db.select().from(invitations)
        .where(and(eq(invitations.token, token), isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date())))
        .limit(1);
      if (rows.length === 0) {
        throw Object.assign(new Error('Invalid or expired invitation token'), { code: 'INVALID_TOKEN' });
      }
      const inv = rows[0]!;
      if (userId) {
        const roleRepo = new DrizzleUserTeamRoleRepository(db);
        await roleRepo.upsert(userId, inv.teamId, inv.role);
        await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.token, token));
        res.json({ teamId: inv.teamId, role: inv.role, message: 'Joined team' });
      } else {
        res.json({ teamId: inv.teamId, email: inv.email, role: inv.role, requiresAuth: true });
      }
    } catch (err) { next(err); }
  });
  return pub;
}

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

router.get('/:id/tournaments', async (req, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);
    await repo.findOrCreateFriendlyForTeam(req.params.id);
    const tournaments = await repo.findByTeam(req.params.id);
    res.json(tournaments);
  } catch (err) { next(err); }
});

const MemberRoleBody = z.object({
  role: z.enum(['COACH', 'ASSISTANT', 'SCOUT', 'VIEWER']),
});

router.put('/:id/members/:userId', async (req, res, next) => {
  try {
    const db = getDb();
    const roleRepo = new DrizzleUserTeamRoleRepository(db);
    const callerRole = await roleRepo.findByUserAndTeam(req.userId, req.params.id);
    if (!callerRole || callerRole.role !== 'OWNER') {
      throw Object.assign(new Error('Only team owners can change member roles'), { code: 'FORBIDDEN' });
    }
    const { role } = MemberRoleBody.parse(req.body);
    await roleRepo.upsert(req.params.userId, req.params.id, role);
    res.json({ userId: req.params.userId, teamId: req.params.id, role });
  } catch (err) { next(err); }
});

router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const db = getDb();
    const roleRepo = new DrizzleUserTeamRoleRepository(db);
    const callerRole = await roleRepo.findByUserAndTeam(req.userId, req.params.id);
    const isSelf = req.userId === req.params.userId;
    const isOwner = callerRole?.role === 'OWNER';
    if (!isOwner && !isSelf) {
      throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' });
    }
    await roleRepo.delete(req.params.userId, req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

const InvitationBody = z.object({
  email: z.string().email(),
  role: z.enum(['COACH', 'ASSISTANT', 'SCOUT', 'VIEWER']),
});

router.post('/:id/invitations', async (req, res, next) => {
  try {
    const db = getDb();
    const roleRepo = new DrizzleUserTeamRoleRepository(db);
    const callerRole = await roleRepo.findByUserAndTeam(req.userId, req.params.id);
    if (!callerRole || !['OWNER', 'COACH'].includes(callerRole.role)) {
      throw Object.assign(new Error('Only owners or coaches can invite members'), { code: 'FORBIDDEN' });
    }
    const { email, role } = InvitationBody.parse(req.body);
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.insert(invitations).values({ token, teamId: req.params.id, email, role, invitedByUserId: req.userId, expiresAt });
    console.log(`Team invite for ${email}: token=${token}`);
    res.status(201).json({ token, email, role, expiresAt });
  } catch (err) { next(err); }
});

export default router;
