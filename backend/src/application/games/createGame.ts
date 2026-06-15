import { z } from 'zod';
import type { IGameRepository } from '../../domain/repositories/game.repository.js';
import type { ITournamentRepository } from '../../domain/repositories/tournament.repository.js';
import type { ITeamRepository } from '../../infrastructure/database/repositories/team.repository.js';
import type { IRosterRepository } from '../../infrastructure/database/repositories/roster.repository.js';
import type { Game } from '../../domain/entities/game.entity.js';

export const CreateGameInput = z.object({
  date: z.string().datetime().optional(),
  location: z.string().optional(),
  format: z.enum(['quarters', 'halves']).default('quarters'),
  numPeriods: z.number().int().min(2).max(4).default(4),
  periodDurationMinutes: z.number().int().min(1).max(20).default(10),
  foulLimitBonus: z.number().int().min(1).max(10).default(5),
  threePointEnabled: z.boolean().default(true),
  // U-02 — away side: either an existing team id (managed or external/scouted)
  // or a free-typed name we find-or-create as an external team for this user.
  awayTeamId: z.string().uuid().optional(),
  awayTeamName: z.string().min(1).max(200).optional(),
  // U-04 — game-day rosters; default to each team's is_default roster.
  homeRosterId: z.string().uuid().optional(),
  awayRosterId: z.string().uuid().optional(),
  notes: z.string().optional(),
  tournamentId: z.string().uuid().optional(),
});

export type CreateGameInput = z.infer<typeof CreateGameInput>;
export type CreateGameRawInput = z.input<typeof CreateGameInput>;

export async function createGame(
  rawInput: CreateGameRawInput & { teamId: string; userId: string },
  gameRepo: IGameRepository,
  tournamentRepo: ITournamentRepository,
  teamRepo: ITeamRepository,
  rosterRepo?: IRosterRepository,
): Promise<Game> {
  const { teamId, userId, ...rest } = rawInput;
  const input = CreateGameInput.parse(rest);

  // Resolve the away team (R2: every game has two teams). Priority:
  // explicit id → find-or-create from a typed name → "Unknown Opponent".
  let awayTeamId = input.awayTeamId;
  if (!awayTeamId) {
    const name = input.awayTeamName?.trim() || input.notes?.trim() || 'Unknown Opponent';
    awayTeamId = (await teamRepo.findOrCreateExternalByName(name, userId)).id;
  }

  const tournamentId = input.tournamentId
    ?? (await tournamentRepo.findOrCreateFriendlyForTeam(teamId)).id;

  // U-04 — resolve game-day rosters. Explicit id wins; otherwise fall back to
  // each team's default ("Full Squad") roster when one exists.
  const homeRosterId =
    input.homeRosterId ?? (rosterRepo ? (await rosterRepo.findDefaultForTeam(teamId))?.id ?? null : null);
  const awayRosterId =
    input.awayRosterId ?? (rosterRepo ? (await rosterRepo.findDefaultForTeam(awayTeamId))?.id ?? null : null);

  return gameRepo.create({
    homeTeamId: teamId,
    awayTeamId,
    homeRosterId,
    awayRosterId,
    date: input.date ? new Date(input.date) : new Date(),
    location: input.location ?? null,
    format: input.format,
    numPeriods: input.numPeriods,
    periodDurationMinutes: input.periodDurationMinutes,
    foulLimitBonus: input.foulLimitBonus,
    threePointEnabled: input.threePointEnabled,
    currentPeriod: 1,
    status: 'scheduled',
    finalScoreHome: null,
    finalScoreAway: null,
    notes: input.notes ?? null,
    currentPossessionTeamId: null,
    possessionArrowTeamId: null,
    tournamentId,
  });
}
