import type { IRosterRepository } from '../../infrastructure/database/repositories/roster.repository.js';

/**
 * R6 — a player may only be added to a roster of their OWN team.
 * Throws FORBIDDEN if any of the given players belongs to a different team.
 */
export async function assertPlayersBelongToTeam(
  playerIds: string[],
  teamId: string,
  rosterRepo: IRosterRepository,
): Promise<void> {
  for (const playerId of playerIds) {
    const playerTeamId = await rosterRepo.getPlayerTeamId(playerId);
    if (playerTeamId === null) {
      throw Object.assign(new Error(`Player ${playerId} not found`), { code: 'NOT_FOUND' });
    }
    if (playerTeamId !== teamId) {
      throw Object.assign(
        new Error(`Player ${playerId} does not belong to team ${teamId} (R6)`),
        { code: 'FORBIDDEN' },
      );
    }
  }
}
