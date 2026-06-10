import { z } from 'zod';
import type { IStatEventRepository } from '../../domain/repositories/game.repository.js';

export const DeleteStatEventInput = z.object({
  gameId: z.string().uuid(),
  eventId: z.string().uuid(),
});

export type DeleteStatEventInput = z.infer<typeof DeleteStatEventInput>;

/**
 * F-08 — soft-deletes a stat event together with its linked children
 * (events whose linked_action_id points at it; one level deep).
 * Children are deleted before the parent.
 */
export async function deleteStatEvent(
  rawInput: DeleteStatEventInput,
  statEventRepo: IStatEventRepository,
): Promise<{ deletedIds: string[] }> {
  const input = DeleteStatEventInput.parse(rawInput);

  const event = await statEventRepo.findById(input.eventId);
  if (!event || event.gameId !== input.gameId) {
    throw Object.assign(new Error('Event not found'), { code: 'NOT_FOUND' });
  }

  const children = await statEventRepo.findByLinkedAction(input.eventId);
  const deletedIds: string[] = [];

  for (const child of children) {
    await statEventRepo.softDelete(child.id);
    deletedIds.push(child.id);
  }

  await statEventRepo.softDelete(input.eventId);
  deletedIds.push(input.eventId);

  return { deletedIds };
}
