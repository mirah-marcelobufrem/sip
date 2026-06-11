import { Router, type Request } from 'express';
import { z } from 'zod';
import { and, count, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../infrastructure/database/connection.js';
import { opponentTeams, opponentPlayers } from '../../infrastructure/database/schema/opponents.schema.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

const TeamBody = z.object({
  name: z.string().min(1).max(200),
  logo: z.string().optional().nullable(),
  homeCourt: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
});

const PlayerBody = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  jerseyNumber: z.number().int().optional(),
  position: z.string().optional(),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  notes: z.string().optional(),
});

// GET /opponent-teams
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const teams = await db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.createdByUserId, req.userId), isNull(opponentTeams.deletedAt)));

    const counts = await db
      .select({
        opponentTeamId: opponentPlayers.opponentTeamId,
        playerCount: count(opponentPlayers.id),
      })
      .from(opponentPlayers)
      .where(isNull(opponentPlayers.deletedAt))
      .groupBy(opponentPlayers.opponentTeamId);

    const countMap = new Map(counts.map(c => [c.opponentTeamId, Number(c.playerCount)]));

    const result = teams.map(t => ({
      ...t,
      playerCount: countMap.get(t.id) ?? 0,
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// POST /opponent-teams
router.post('/', async (req, res, next) => {
  try {
    const body = TeamBody.parse(req.body);
    const db = getDb();
    const [team] = await db
      .insert(opponentTeams)
      .values({
        createdByUserId: req.userId,
        name: body.name,
        logo: body.logo ?? null,
        homeCourt: body.homeCourt ?? null,
        contactName: body.contactName ?? null,
        contactEmail: body.contactEmail ?? null,
      })
      .returning();
    res.status(201).json(team);
  } catch (err) { next(err); }
});

// GET /opponent-teams/:id
router.get('/:id', async (req: Request<{ id: string }>, res, next) => {
  try {
    const db = getDb();
    const team = await db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.id, req.params.id), eq(opponentTeams.createdByUserId, req.userId), isNull(opponentTeams.deletedAt)))
      .then(rows => rows[0] ?? null);
    if (!team) {
      res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return;
    }
    const players = await db
      .select()
      .from(opponentPlayers)
      .where(and(eq(opponentPlayers.opponentTeamId, req.params.id), isNull(opponentPlayers.deletedAt)));
    res.json({ ...team, players });
  } catch (err) { next(err); }
});

// PUT /opponent-teams/:id
router.put('/:id', async (req: Request<{ id: string }>, res, next) => {
  try {
    const body = TeamBody.partial().parse(req.body);
    const db = getDb();
    const existing = await db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.id, req.params.id), eq(opponentTeams.createdByUserId, req.userId), isNull(opponentTeams.deletedAt)))
      .then(rows => rows[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return;
    }
    const [updated] = await db
      .update(opponentTeams)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.logo !== undefined ? { logo: body.logo } : {}),
        ...(body.homeCourt !== undefined ? { homeCourt: body.homeCourt } : {}),
        ...(body.contactName !== undefined ? { contactName: body.contactName } : {}),
        ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
        updatedAt: new Date(),
      })
      .where(eq(opponentTeams.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /opponent-teams/:id
router.delete('/:id', async (req: Request<{ id: string }>, res, next) => {
  try {
    const db = getDb();
    const existing = await db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.id, req.params.id), eq(opponentTeams.createdByUserId, req.userId), isNull(opponentTeams.deletedAt)))
      .then(rows => rows[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return;
    }
    await db
      .update(opponentTeams)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(opponentTeams.id, req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /opponent-teams/:id/players
router.get('/:id/players', async (req: Request<{ id: string }>, res, next) => {
  try {
    const db = getDb();
    const team = await db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.id, req.params.id), eq(opponentTeams.createdByUserId, req.userId), isNull(opponentTeams.deletedAt)))
      .then(rows => rows[0] ?? null);
    if (!team) {
      res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return;
    }
    const players = await db
      .select()
      .from(opponentPlayers)
      .where(and(eq(opponentPlayers.opponentTeamId, req.params.id), isNull(opponentPlayers.deletedAt)));
    res.json(players);
  } catch (err) { next(err); }
});

// POST /opponent-teams/:id/players
router.post('/:id/players', async (req: Request<{ id: string }>, res, next) => {
  try {
    const body = PlayerBody.parse(req.body);
    const db = getDb();
    const team = await db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.id, req.params.id), eq(opponentTeams.createdByUserId, req.userId), isNull(opponentTeams.deletedAt)))
      .then(rows => rows[0] ?? null);
    if (!team) {
      res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return;
    }
    const [player] = await db
      .insert(opponentPlayers)
      .values({
        opponentTeamId: req.params.id,
        firstName: body.firstName,
        lastName: body.lastName,
        jerseyNumber: body.jerseyNumber ?? null,
        position: body.position ?? null,
        heightCm: body.heightCm ?? null,
        weightKg: body.weightKg ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    res.status(201).json(player);
  } catch (err) { next(err); }
});

// PUT /opponent-teams/:id/players/:playerId
router.put('/:id/players/:playerId', async (req: Request<{ id: string; playerId: string }>, res, next) => {
  try {
    const body = PlayerBody.partial().parse(req.body);
    const db = getDb();
    const team = await db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.id, req.params.id), eq(opponentTeams.createdByUserId, req.userId), isNull(opponentTeams.deletedAt)))
      .then(rows => rows[0] ?? null);
    if (!team) {
      res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return;
    }
    const existing = await db
      .select()
      .from(opponentPlayers)
      .where(
        and(
          eq(opponentPlayers.id, req.params.playerId),
          eq(opponentPlayers.opponentTeamId, req.params.id),
          isNull(opponentPlayers.deletedAt),
        ),
      )
      .then(rows => rows[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: 'Opponent player not found', code: 'NOT_FOUND' }); return;
    }
    const [updated] = await db
      .update(opponentPlayers)
      .set({
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.jerseyNumber !== undefined ? { jerseyNumber: body.jerseyNumber } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
        ...(body.heightCm !== undefined ? { heightCm: body.heightCm } : {}),
        ...(body.weightKg !== undefined ? { weightKg: body.weightKg } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(opponentPlayers.id, req.params.playerId))
      .returning();
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /opponent-teams/:id/players/:playerId
router.delete('/:id/players/:playerId', async (req: Request<{ id: string; playerId: string }>, res, next) => {
  try {
    const db = getDb();
    const team = await db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.id, req.params.id), eq(opponentTeams.createdByUserId, req.userId), isNull(opponentTeams.deletedAt)))
      .then(rows => rows[0] ?? null);
    if (!team) {
      res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return;
    }
    const existing = await db
      .select()
      .from(opponentPlayers)
      .where(
        and(
          eq(opponentPlayers.id, req.params.playerId),
          eq(opponentPlayers.opponentTeamId, req.params.id),
          isNull(opponentPlayers.deletedAt),
        ),
      )
      .then(rows => rows[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: 'Opponent player not found', code: 'NOT_FOUND' }); return;
    }
    await db
      .update(opponentPlayers)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(opponentPlayers.id, req.params.playerId));
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /opponent-teams/:id/stats
router.get('/:id/stats', async (req: Request<{ id: string }>, res, next) => {
  try {
    const db = getDb();
    const team = await db
      .select()
      .from(opponentTeams)
      .where(and(eq(opponentTeams.id, req.params.id), eq(opponentTeams.createdByUserId, req.userId), isNull(opponentTeams.deletedAt)))
      .then(rows => rows[0] ?? null);
    if (!team) {
      res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return;
    }
    // Link between games and opponent_teams is not yet wired — return stub
    res.json({ games: 0, avgPts: 0 });
  } catch (err) { next(err); }
});

export default router;
