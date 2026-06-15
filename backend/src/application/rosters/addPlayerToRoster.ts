import { z } from 'zod';
import type { IRosterRepository } from '../../infrastructure/database/repositories/roster.repository.js';
import { assertPlayersBelongToTeam } from './eligibility.js';

export const AddPlayerInput = z.object({
  rosterId: z.string().uuid(),
  playerId: z.string().uuid(),
  teamId: z.string().uuid(),
});

export type AddPlayerInput = z.infer<typeof AddPlayerInput>;

/**
 * Adds a player to a roster, enforcing R6 (player.teamId === roster.teamId).
 */
export async function addPlayerToRoster(
  rawInput: AddPlayerInput,
  rosterRepo: IRosterRepository,
): Promise<void> {
  const input = AddPlayerInput.parse(rawInput);

  const roster = await rosterRepo.findById(input.rosterId);
  if (!roster || roster.teamId !== input.teamId) {
    throw Object.assign(new Error('Roster not found for this team'), { code: 'NOT_FOUND' });
  }

  // R6 — the player must belong to the roster's team.
  await assertPlayersBelongToTeam([input.playerId], roster.teamId, rosterRepo);

  await rosterRepo.addPlayer(input.rosterId, input.playerId);
}
