import { z } from 'zod';
import type { IGameRepository } from '../../domain/repositories/game.repository.js';
import type { ITournamentRepository } from '../../domain/repositories/tournament.repository.js';
import type { Game } from '../../domain/entities/game.entity.js';

export const CreateGameInput = z.object({
  date: z.string().datetime().optional(),
  location: z.string().optional(),
  format: z.enum(['quarters', 'halves']).default('quarters'),
  numPeriods: z.number().int().min(2).max(4).default(4),
  periodDurationMinutes: z.number().int().min(1).max(20).default(10),
  foulLimitBonus: z.number().int().min(1).max(10).default(5),
  threePointEnabled: z.boolean().default(true),
  awayTeamId: z.string().uuid().optional(),
  awayOpponentTeamId: z.string().uuid().optional(),
  notes: z.string().optional(),
  tournamentId: z.string().uuid().optional(),
});

export type CreateGameInput = z.infer<typeof CreateGameInput>;
export type CreateGameRawInput = z.input<typeof CreateGameInput>;

export async function createGame(
  rawInput: CreateGameRawInput & { teamId: string },
  gameRepo: IGameRepository,
  tournamentRepo: ITournamentRepository,
): Promise<Game> {
  const { teamId, ...rest } = rawInput;
  const input = CreateGameInput.parse(rest);
  const tournamentId = input.tournamentId
    ?? (await tournamentRepo.findOrCreateFriendlyForTeam(teamId)).id;

  return gameRepo.create({
    homeTeamId: teamId,
    awayTeamId: input.awayTeamId ?? null,
    homeOpponentTeamId: null,
    awayOpponentTeamId: input.awayOpponentTeamId ?? null,
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
