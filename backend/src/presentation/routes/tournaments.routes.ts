import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../../infrastructure/database/connection.js';
import { DrizzleTournamentRepository } from '../../infrastructure/database/repositories/tournament.repository.js';
import { authenticate } from '../middleware/auth.middleware.js';
import {
  generateSingleElimination,
  generateDoubleElimination,
  generateRoundRobin,
  calculateStandings,
  type GameResult,
} from '../../domain/tournament-bracket.js';

const router = Router();

const TeamEntrySchema = z.object({
  seed: z.number().int().min(1),
  teamId: z.string().uuid().optional(),
  teamName: z.string().min(1).max(100),
});

const CreateTournamentSchema = z.object({
  name: z.string().min(1).max(200),
  format: z.enum(['single_elimination', 'double_elimination', 'round_robin', 'mixed']),
  numTeams: z.number().int().min(2).max(64),
  teams: z.array(TeamEntrySchema),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const UpdateTournamentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['upcoming', 'active', 'completed']).optional(),
  teams: z.array(TeamEntrySchema).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// All authenticated routes
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);
    res.json(await repo.findAll());
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const body = CreateTournamentSchema.parse(req.body);
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);

    const tournament = await repo.create({
      name: body.name,
      format: body.format,
      numTeams: body.numTeams,
      teams: body.teams,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });

    // Auto-generate bracket slots
    let slots;
    if (body.format === 'single_elimination') {
      slots = generateSingleElimination(body.numTeams);
    } else if (body.format === 'double_elimination') {
      slots = generateDoubleElimination(body.numTeams);
    } else if (body.format === 'round_robin') {
      slots = generateRoundRobin(body.numTeams);
    } else {
      slots = generateSingleElimination(body.numTeams);
    }

    await repo.insertBracketSlots(tournament.id, slots);
    res.status(201).json(tournament);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);
    const tournament = await repo.findById(req.params.id);
    if (!tournament) return void res.status(404).json({ error: 'Not found' });
    const slots = await repo.getBracketSlots(req.params.id);
    res.json({ ...tournament, slots });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const body = UpdateTournamentSchema.parse(req.body);
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);
    const tournament = await repo.update(req.params.id, {
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
    res.json(tournament);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);
    await repo.delete(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

router.get('/:id/bracket', async (req, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);
    const tournament = await repo.findById(req.params.id);
    if (!tournament) return void res.status(404).json({ error: 'Not found' });
    const slots = await repo.getBracketSlots(req.params.id);
    res.json({ tournament, slots });
  } catch (err) { next(err); }
});

router.patch('/:id/slots/:slotId', async (req, res, next) => {
  try {
    const body = z.object({
      gameId: z.string().uuid().optional(),
      homeSeed: z.number().int().nullable().optional(),
      awaySeed: z.number().int().nullable().optional(),
    }).parse(req.body);
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);
    await repo.updateBracketSlot(req.params.slotId, body);
    res.status(204).end();
  } catch (err) { next(err); }
});

router.get('/:id/standings', async (req, res, next) => {
  try {
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);
    const tournament = await repo.findById(req.params.id);
    if (!tournament) return void res.status(404).json({ error: 'Not found' });

    const slots = await repo.getBracketSlots(req.params.id);
    // Build results from completed slots that have scores stored in game records
    // For now we derive from the teams field wins/losses stored there
    // Results from completed tournament slots (game scores fetched when available)
    const results: GameResult[] = [];

    const standings = calculateStandings(
      (tournament.teams as Array<{ seed: number; teamName: string; teamId?: string }>),
      results,
    );
    res.json(standings);
  } catch (err) { next(err); }
});

router.post('/:id/share', async (req, res, next) => {
  try {
    const { revoke } = z.object({ revoke: z.boolean().default(false) }).parse(req.body);
    const db = getDb();
    const repo = new DrizzleTournamentRepository(db);
    if (revoke) {
      await repo.revokeShareToken(req.params.id);
      res.json({ shareToken: null });
    } else {
      const token = await repo.generateShareToken(req.params.id);
      res.json({ shareToken: token });
    }
  } catch (err) { next(err); }
});

export default router;

// Public route — no auth
export function publicTournamentsRouter(): Router {
  const pub = Router();
  pub.get('/share/:token', async (req, res, next) => {
    try {
      const db = getDb();
      const repo = new DrizzleTournamentRepository(db);
      const tournament = await repo.findByShareToken(req.params.token);
      if (!tournament) return void res.status(404).json({ error: 'Not found' });
      const slots = await repo.getBracketSlots(tournament.id);
      res.json({ tournament, slots });
    } catch (err) { next(err); }
  });
  return pub;
}
