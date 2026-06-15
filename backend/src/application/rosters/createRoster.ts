import { z } from 'zod';
import type { IRosterRepository } from '../../infrastructure/database/repositories/roster.repository.js';
import { assertPlayersBelongToTeam } from './eligibility.js';

export const CreateRosterInput = z.object({
  name: z.string().min(1).max(120),
  seasonLabel: z.string().max(120).optional(),
  isDefault: z.boolean().default(false),
  // Seed the roster with these players (R6: each must belong to the team)…
  playerIds: z.array(z.string().uuid()).optional(),
  // …or copy the player set from an existing roster of the same team.
  copyFromRosterId: z.string().uuid().optional(),
});

export type CreateRosterInput = z.infer<typeof CreateRosterInput>;
export type CreateRosterRawInput = z.input<typeof CreateRosterInput>;

export async function createRoster(
  rawInput: CreateRosterRawInput & { teamId: string },
  rosterRepo: IRosterRepository,
): Promise<{ id: string; teamId: string; name: string; seasonLabel: string | null; isDefault: boolean }> {
  const { teamId, ...rest } = rawInput;
  const input = CreateRosterInput.parse(rest);

  let playerIds = input.playerIds ?? [];
  if (input.copyFromRosterId) {
    const source = await rosterRepo.findById(input.copyFromRosterId);
    if (!source || source.teamId !== teamId) {
      throw Object.assign(new Error('Source roster not found for this team'), { code: 'NOT_FOUND' });
    }
    playerIds = [...new Set([...playerIds, ...(await rosterRepo.getPlayerIds(input.copyFromRosterId))])];
  }

  // R6 — every player on a roster must belong to that roster's team.
  await assertPlayersBelongToTeam(playerIds, teamId, rosterRepo);

  const roster = await rosterRepo.create({
    teamId,
    name: input.name,
    seasonLabel: input.seasonLabel ?? null,
    isDefault: input.isDefault,
  });
  if (playerIds.length > 0) {
    await rosterRepo.setPlayers(roster.id, playerIds);
  }
  return roster;
}
