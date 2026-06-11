import { z } from 'zod';
import type { IStatEventRepository, ILineupSnapshotRepository } from '../../domain/repositories/game.repository.js';

export const RecordSubstitutionInput = z.object({
  gameId: z.string().uuid(),
  teamId: z.string().uuid(),
  period: z.number().int().min(1),
  clockTimeSeconds: z.number().int().optional(),
  playerOutId: z.string().uuid(),
  playerInId: z.string().uuid(),
});

export type RecordSubstitutionInput = z.infer<typeof RecordSubstitutionInput>;

export async function recordSubstitution(
  input: RecordSubstitutionInput,
  statEventRepo: IStatEventRepository,
  lineupRepo: ILineupSnapshotRepository,
) {
  const currentLineup = await lineupRepo.findLatestByGameAndTeam(input.gameId, input.teamId);

  const currentPlayerIds = currentLineup?.playerIds ?? [];
  const newPlayerIds = currentPlayerIds
    .filter((id) => id !== input.playerOutId)
    .concat(input.playerInId);

  const snapshot = await lineupRepo.create({
    gameId: input.gameId,
    teamId: input.teamId,
    period: input.period,
    clockTimeSeconds: input.clockTimeSeconds ?? null,
    playerIds: newPlayerIds,
  });

  await statEventRepo.create({
    gameId: input.gameId,
    period: input.period,
    clockTimeSeconds: input.clockTimeSeconds ?? null,
    playerId: input.playerOutId,
    teamId: input.teamId,
    statType: 'SUB_OUT',
    value: 1,
    xCourt: null,
    yCourt: null,
    lineupSnapshotId: snapshot.id,
    seq: null,
    linkedActionId: null,
    linkRole: null,
    waveSubGroupId: null,
    isTeamRebound: false,
    isBenchFoul: false,
  });

  await statEventRepo.create({
    gameId: input.gameId,
    period: input.period,
    clockTimeSeconds: input.clockTimeSeconds ?? null,
    playerId: input.playerInId,
    teamId: input.teamId,
    statType: 'SUB_IN',
    value: 1,
    xCourt: null,
    yCourt: null,
    lineupSnapshotId: snapshot.id,
    seq: null,
    linkedActionId: null,
    linkRole: null,
    waveSubGroupId: null,
    isTeamRebound: false,
    isBenchFoul: false,
  });

  return snapshot;
}
