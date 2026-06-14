import { Router, type Request } from 'express';
import { z } from 'zod';
import { and, count, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../infrastructure/database/connection.js';
import { teams } from '../../infrastructure/database/schema/teams.schema.js';
import { players } from '../../infrastructure/database/schema/players.schema.js';
import { authenticate } from '../middleware/auth.middleware.js';

/**
 * U-01/U-02 — "Scouted teams" API. After the One Team Universe migration these
 * routes are THIN ALIASES over the unified teams/players tables: an opponent
 * team is a `teams` row with kind='external', owned via created_by_user_id
 * (preserving the v1.6.1 ownership scoping); opponent players are plain
 * `players` rows. The /opponent-teams path is retained one release for the
 * frontend Scouted tab + tournament team picker; responses map photo→logo for
 * backward compatibility.
 */

const router = Router({ mergeParams: true });
router.use(authenticate);

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const;
const coercePosition = (p?: string | null): (typeof POSITIONS)[number] | null =>
  p && (POSITIONS as readonly string[]).includes(p) ? (p as (typeof POSITIONS)[number]) : null;

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

// Map a unified external-team row to the legacy opponent-team response shape.
function toOpponentTeam(t: typeof teams.$inferSelect) {
  return {
    id: t.id,
    createdByUserId: t.createdByUserId,
    name: t.name,
    logo: t.photo,
    homeCourt: t.homeCourt,
    contactName: t.contactName,
    contactEmail: t.contactEmail,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    deletedAt: t.deletedAt,
  };
}

/** Load an external team owned by the caller, or null (404 → no existence leak). */
async function ownedExternalTeam(db: ReturnType<typeof getDb>, id: string, userId: string) {
  const rows = await db
    .select()
    .from(teams)
    .where(
      and(
        eq(teams.id, id),
        eq(teams.kind, 'external'),
        eq(teams.createdByUserId, userId),
        isNull(teams.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// GET /opponent-teams
router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(teams)
      .where(and(eq(teams.kind, 'external'), eq(teams.createdByUserId, req.userId), isNull(teams.deletedAt)));

    const counts = await db
      .select({ teamId: players.teamId, playerCount: count(players.id) })
      .from(players)
      .where(isNull(players.deletedAt))
      .groupBy(players.teamId);
    const countMap = new Map(counts.map((c) => [c.teamId, Number(c.playerCount)]));

    res.json(rows.map((t) => ({ ...toOpponentTeam(t), playerCount: countMap.get(t.id) ?? 0 })));
  } catch (err) { next(err); }
});

// POST /opponent-teams
router.post('/', async (req, res, next) => {
  try {
    const body = TeamBody.parse(req.body);
    const db = getDb();
    const [team] = await db
      .insert(teams)
      .values({
        kind: 'external',
        createdByUserId: req.userId,
        name: body.name,
        photo: body.logo ?? null,
        homeCourt: body.homeCourt ?? null,
        contactName: body.contactName ?? null,
        contactEmail: body.contactEmail ?? null,
      })
      .returning();
    res.status(201).json(toOpponentTeam(team!));
  } catch (err) { next(err); }
});

// GET /opponent-teams/:id
router.get('/:id', async (req: Request<{ id: string }>, res, next) => {
  try {
    const db = getDb();
    const team = await ownedExternalTeam(db, req.params.id, req.userId);
    if (!team) { res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return; }
    const roster = await db
      .select()
      .from(players)
      .where(and(eq(players.teamId, req.params.id), isNull(players.deletedAt)));
    res.json({ ...toOpponentTeam(team), players: roster });
  } catch (err) { next(err); }
});

// PUT /opponent-teams/:id
router.put('/:id', async (req: Request<{ id: string }>, res, next) => {
  try {
    const body = TeamBody.partial().parse(req.body);
    const db = getDb();
    const team = await ownedExternalTeam(db, req.params.id, req.userId);
    if (!team) { res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return; }
    const [updated] = await db
      .update(teams)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.logo !== undefined ? { photo: body.logo } : {}),
        ...(body.homeCourt !== undefined ? { homeCourt: body.homeCourt } : {}),
        ...(body.contactName !== undefined ? { contactName: body.contactName } : {}),
        ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, req.params.id))
      .returning();
    res.json(toOpponentTeam(updated!));
  } catch (err) { next(err); }
});

// DELETE /opponent-teams/:id
router.delete('/:id', async (req: Request<{ id: string }>, res, next) => {
  try {
    const db = getDb();
    const team = await ownedExternalTeam(db, req.params.id, req.userId);
    if (!team) { res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return; }
    await db.update(teams).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(teams.id, req.params.id));
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /opponent-teams/:id/players
router.get('/:id/players', async (req: Request<{ id: string }>, res, next) => {
  try {
    const db = getDb();
    const team = await ownedExternalTeam(db, req.params.id, req.userId);
    if (!team) { res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return; }
    const roster = await db
      .select()
      .from(players)
      .where(and(eq(players.teamId, req.params.id), isNull(players.deletedAt)));
    res.json(roster);
  } catch (err) { next(err); }
});

// POST /opponent-teams/:id/players
router.post('/:id/players', async (req: Request<{ id: string }>, res, next) => {
  try {
    const body = PlayerBody.parse(req.body);
    const db = getDb();
    const team = await ownedExternalTeam(db, req.params.id, req.userId);
    if (!team) { res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return; }
    const [player] = await db
      .insert(players)
      .values({
        teamId: req.params.id,
        firstName: body.firstName,
        lastName: body.lastName,
        jerseyNumber: body.jerseyNumber ?? null,
        position: coercePosition(body.position),
        heightCm: body.heightCm ?? null,
        weightKg: body.weightKg ?? null,
        notes: body.notes ?? null,
        status: 'active',
      })
      .returning();
    res.status(201).json(player!);
  } catch (err) { next(err); }
});

// PUT /opponent-teams/:id/players/:playerId
router.put('/:id/players/:playerId', async (req: Request<{ id: string; playerId: string }>, res, next) => {
  try {
    const body = PlayerBody.partial().parse(req.body);
    const db = getDb();
    const team = await ownedExternalTeam(db, req.params.id, req.userId);
    if (!team) { res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return; }
    const existing = await db
      .select()
      .from(players)
      .where(and(eq(players.id, req.params.playerId), eq(players.teamId, req.params.id), isNull(players.deletedAt)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!existing) { res.status(404).json({ error: 'Opponent player not found', code: 'NOT_FOUND' }); return; }
    const [updated] = await db
      .update(players)
      .set({
        ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
        ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
        ...(body.jerseyNumber !== undefined ? { jerseyNumber: body.jerseyNumber } : {}),
        ...(body.position !== undefined ? { position: coercePosition(body.position) } : {}),
        ...(body.heightCm !== undefined ? { heightCm: body.heightCm } : {}),
        ...(body.weightKg !== undefined ? { weightKg: body.weightKg } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(players.id, req.params.playerId))
      .returning();
    res.json(updated!);
  } catch (err) { next(err); }
});

// DELETE /opponent-teams/:id/players/:playerId
router.delete('/:id/players/:playerId', async (req: Request<{ id: string; playerId: string }>, res, next) => {
  try {
    const db = getDb();
    const team = await ownedExternalTeam(db, req.params.id, req.userId);
    if (!team) { res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return; }
    const existing = await db
      .select()
      .from(players)
      .where(and(eq(players.id, req.params.playerId), eq(players.teamId, req.params.id), isNull(players.deletedAt)))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!existing) { res.status(404).json({ error: 'Opponent player not found', code: 'NOT_FOUND' }); return; }
    await db.update(players).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(players.id, req.params.playerId));
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /opponent-teams/:id/stats — tendency aggregation lands in v5 S10 (N-09)
router.get('/:id/stats', async (req: Request<{ id: string }>, res, next) => {
  try {
    const db = getDb();
    const team = await ownedExternalTeam(db, req.params.id, req.userId);
    if (!team) { res.status(404).json({ error: 'Opponent team not found', code: 'NOT_FOUND' }); return; }
    res.json({ games: 0, avgPts: 0 });
  } catch (err) { next(err); }
});

export default router;
