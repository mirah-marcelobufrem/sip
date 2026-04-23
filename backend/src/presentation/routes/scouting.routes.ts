import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleScoutingReportRepository } from '../../infrastructure/database/repositories/scouting.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

const ReportBody = z.object({
  title: z.string().min(1).max(200),
  subjectPlayerId: z.string().uuid().optional(),
  subjectTeamId: z.string().uuid().optional(),
  gameId: z.string().uuid().optional(),
  reportDate: z.string().datetime().optional(),
  summary: z.string().optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  recommendation: z.enum(['sign', 'monitor', 'pass', 'no_action']).optional(),
  overallRating: z.number().int().min(1).max(10).optional(),
  skillRatings: z.record(z.number()).optional(),
  tags: z.array(z.string()).optional(),
  isOpponentReport: z.boolean().default(false),
  visibility: z.enum(['private', 'team', 'link']).default('private'),
});

router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const reports = await new DrizzleScoutingReportRepository(db).findByUser(req.userId);
    res.json(reports);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const body = ReportBody.parse(req.body);
    const db = getDb();
    const report = await new DrizzleScoutingReportRepository(db).create({
      ...body,
      authorUserId: req.userId,
      reportDate: body.reportDate ? new Date(body.reportDate) : new Date(),
      subjectPlayerId: body.subjectPlayerId ?? null,
      subjectTeamId: body.subjectTeamId ?? null,
      gameId: body.gameId ?? null,
      summary: body.summary ?? null,
      strengths: body.strengths ?? null,
      weaknesses: body.weaknesses ?? null,
      recommendation: body.recommendation ?? null,
      overallRating: body.overallRating ?? null,
      skillRatings: body.skillRatings ?? null,
      videoLinks: null,
      attachments: null,
      shareToken: null,
      tags: body.tags ?? null,
    });
    res.status(201).json(report);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const report = await new DrizzleScoutingReportRepository(db).findById(req.params.id);
    if (!report) { res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' }); return; }
    if (report.authorUserId !== req.userId && report.visibility === 'private') {
      res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' }); return;
    }
    res.json(report);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const body = ReportBody.partial().parse(req.body);
    const db = getDb();
    const repo = new DrizzleScoutingReportRepository(db);
    const existing = await repo.findById(req.params.id);
    if (!existing || existing.authorUserId !== req.userId) {
      res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' }); return;
    }
    const { reportDate, skillRatings, ...rest } = body;
    const report = await repo.update(req.params.id, {
      ...rest,
      ...(reportDate !== undefined ? { reportDate: new Date(reportDate) } : {}),
      ...(skillRatings !== undefined ? { skillRatings } : {}),
    });
    res.json(report);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleScoutingReportRepository(db);
    const existing = await repo.findById(req.params.id);
    if (!existing || existing.authorUserId !== req.userId) {
      res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' }); return;
    }
    await repo.softDelete(req.params.id);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/:id/share', async (req, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleScoutingReportRepository(db);
    const existing = await repo.findById(req.params.id);
    if (!existing || existing.authorUserId !== req.userId) {
      res.status(404).json({ error: 'Report not found', code: 'NOT_FOUND' }); return;
    }
    const { revoke } = z.object({ revoke: z.boolean().default(false) }).parse(req.body);
    if (revoke) {
      await repo.revokeShare(req.params.id);
      res.json({ shareToken: null });
    } else {
      const token = await repo.generateShareToken(req.params.id);
      res.json({ shareToken: token });
    }
  } catch (err) { next(err); }
});

export default router;
