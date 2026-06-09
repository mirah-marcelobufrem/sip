import { Router, type Request } from 'express';
import { z } from 'zod';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../infrastructure/database/connection.js';
import { developmentEntries, developmentGoals } from '../../infrastructure/database/schema/development.schema.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router({ mergeParams: true });
router.use(authenticate);

const EntryBody = z.object({
  date: z.string().datetime(),
  category: z.enum(['physical', 'technical', 'tactical', 'mental']),
  metricName: z.string().min(1).max(200),
  metricValue: z.number().optional(),
  metricValueText: z.string().optional(),
  notes: z.string().optional(),
});

const GoalBody = z.object({
  metricName: z.string().min(1).max(200),
  targetValue: z.number(),
  targetDate: z.string().datetime().optional(),
  achievedAt: z.string().datetime().optional(),
});

// GET /players/:playerId/development
router.get('/:playerId/development', async (req: Request<{ playerId: string }>, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(developmentEntries)
      .where(eq(developmentEntries.playerId, req.params.playerId))
      .orderBy(desc(developmentEntries.date));
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /players/:playerId/development
router.post('/:playerId/development', async (req: Request<{ playerId: string }>, res, next) => {
  try {
    const body = EntryBody.parse(req.body);
    const db = getDb();
    const [entry] = await db
      .insert(developmentEntries)
      .values({
        playerId: req.params.playerId,
        coachUserId: req.userId,
        date: new Date(body.date),
        category: body.category,
        metricName: body.metricName,
        metricValue: body.metricValue ?? null,
        metricValueText: body.metricValueText ?? null,
        notes: body.notes ?? null,
      })
      .returning();
    res.status(201).json(entry);
  } catch (err) { next(err); }
});

// PUT /players/:playerId/development/:entryId
router.put('/:playerId/development/:entryId', async (req: Request<{ playerId: string; entryId: string }>, res, next) => {
  try {
    const body = EntryBody.partial().parse(req.body);
    const db = getDb();
    const existing = await db
      .select()
      .from(developmentEntries)
      .where(
        and(
          eq(developmentEntries.id, req.params.entryId),
          eq(developmentEntries.playerId, req.params.playerId),
        ),
      )
      .then(rows => rows[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: 'Entry not found', code: 'NOT_FOUND' }); return;
    }
    const [updated] = await db
      .update(developmentEntries)
      .set({
        ...(body.date !== undefined ? { date: new Date(body.date) } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.metricName !== undefined ? { metricName: body.metricName } : {}),
        ...(body.metricValue !== undefined ? { metricValue: body.metricValue } : {}),
        ...(body.metricValueText !== undefined ? { metricValueText: body.metricValueText } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        updatedAt: new Date(),
      })
      .where(eq(developmentEntries.id, req.params.entryId))
      .returning();
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /players/:playerId/development/:entryId
router.delete('/:playerId/development/:entryId', async (req: Request<{ playerId: string; entryId: string }>, res, next) => {
  try {
    const db = getDb();
    const existing = await db
      .select()
      .from(developmentEntries)
      .where(
        and(
          eq(developmentEntries.id, req.params.entryId),
          eq(developmentEntries.playerId, req.params.playerId),
        ),
      )
      .then(rows => rows[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: 'Entry not found', code: 'NOT_FOUND' }); return;
    }
    await db
      .delete(developmentEntries)
      .where(eq(developmentEntries.id, req.params.entryId));
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /players/:playerId/development/goals
router.get('/:playerId/development/goals', async (req: Request<{ playerId: string }>, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(developmentGoals)
      .where(eq(developmentGoals.playerId, req.params.playerId))
      .orderBy(desc(developmentGoals.createdAt));
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /players/:playerId/development/goals
router.post('/:playerId/development/goals', async (req: Request<{ playerId: string }>, res, next) => {
  try {
    const body = GoalBody.parse(req.body);
    const db = getDb();
    const [goal] = await db
      .insert(developmentGoals)
      .values({
        playerId: req.params.playerId,
        coachUserId: req.userId,
        metricName: body.metricName,
        targetValue: body.targetValue,
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
        achievedAt: body.achievedAt ? new Date(body.achievedAt) : null,
      })
      .returning();
    res.status(201).json(goal);
  } catch (err) { next(err); }
});

// PUT /players/:playerId/development/goals/:goalId
router.put('/:playerId/development/goals/:goalId', async (req: Request<{ playerId: string; goalId: string }>, res, next) => {
  try {
    const body = GoalBody.partial().parse(req.body);
    const db = getDb();
    const existing = await db
      .select()
      .from(developmentGoals)
      .where(
        and(
          eq(developmentGoals.id, req.params.goalId),
          eq(developmentGoals.playerId, req.params.playerId),
        ),
      )
      .then(rows => rows[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: 'Goal not found', code: 'NOT_FOUND' }); return;
    }
    const [updated] = await db
      .update(developmentGoals)
      .set({
        ...(body.metricName !== undefined ? { metricName: body.metricName } : {}),
        ...(body.targetValue !== undefined ? { targetValue: body.targetValue } : {}),
        ...(body.targetDate !== undefined ? { targetDate: new Date(body.targetDate) } : {}),
        ...(body.achievedAt !== undefined ? { achievedAt: new Date(body.achievedAt) } : {}),
      })
      .where(eq(developmentGoals.id, req.params.goalId))
      .returning();
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /players/:playerId/development/goals/:goalId
router.delete('/:playerId/development/goals/:goalId', async (req: Request<{ playerId: string; goalId: string }>, res, next) => {
  try {
    const db = getDb();
    const existing = await db
      .select()
      .from(developmentGoals)
      .where(
        and(
          eq(developmentGoals.id, req.params.goalId),
          eq(developmentGoals.playerId, req.params.playerId),
        ),
      )
      .then(rows => rows[0] ?? null);
    if (!existing) {
      res.status(404).json({ error: 'Goal not found', code: 'NOT_FOUND' }); return;
    }
    await db
      .delete(developmentGoals)
      .where(eq(developmentGoals.id, req.params.goalId));
    res.status(204).send();
  } catch (err) { next(err); }
});

// GET /players/:playerId/development/chart
router.get('/:playerId/development/chart', async (req: Request<{ playerId: string }>, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(developmentEntries)
      .where(eq(developmentEntries.playerId, req.params.playerId))
      .orderBy(asc(developmentEntries.date));

    // Group by metricName
    const grouped = new Map<string, { date: string; value: number | null; notes: string | null }[]>();
    for (const row of rows) {
      const metric = row.metricName;
      if (!grouped.has(metric)) grouped.set(metric, []);
      grouped.get(metric)!.push({
        date: row.date.toISOString(),
        value: row.metricValue ?? null,
        notes: row.notes ?? null,
      });
    }

    const result = Array.from(grouped.entries()).map(([metricName, entries]) => ({
      metricName,
      entries,
    }));

    res.json(result);
  } catch (err) { next(err); }
});

export default router;
