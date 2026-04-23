import { z } from 'zod';
import type { IStatEventRepository, ILineupSnapshotRepository } from '../../domain/repositories/game.repository.js';
import type { StatType } from '../../domain/entities/game.entity.js';

export const RecordStatEventInput = z.object({
  gameId: z.string().uuid(),
  period: z.number().int().min(1),
  clockTimeSeconds: z.number().int().optional(),
  playerId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  statType: z.enum([
    '2PM', '2PA', '3PM', '3PA', 'FTM', 'FTA',
    'OREB', 'DREB', 'AST', 'TO', 'STL', 'BLK', 'DFD',
    'PF', 'TF', 'FF', 'SUB_IN', 'SUB_OUT',
    'PERIOD_START', 'PERIOD_END', 'TIMEOUT',
  ]),
  value: z.number().int().default(1),
  xCourt: z.number().min(0).max(1).optional(),
  yCourt: z.number().min(0).max(1).optional(),
});

export type RecordStatEventInput = z.infer<typeof RecordStatEventInput>;
export type RecordStatEventRawInput = z.input<typeof RecordStatEventInput>;

export async function recordStatEvent(
  rawInput: RecordStatEventRawInput,
  statEventRepo: IStatEventRepository,
  lineupRepo: ILineupSnapshotRepository,
) {
  const input = RecordStatEventInput.parse(rawInput);
  const lineup = await lineupRepo.findLatestByGameAndTeam(
    input.gameId,
    input.teamId ?? '',
  );

  const event = await statEventRepo.create({
    gameId: input.gameId,
    period: input.period,
    clockTimeSeconds: input.clockTimeSeconds ?? null,
    playerId: input.playerId ?? null,
    teamId: input.teamId ?? null,
    statType: input.statType as StatType,
    value: input.value,
    xCourt: input.xCourt ?? null,
    yCourt: input.yCourt ?? null,
    lineupSnapshotId: lineup?.id ?? null,
  });

  return event;
}
