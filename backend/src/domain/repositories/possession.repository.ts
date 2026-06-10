import type { PossessionSequence } from '../entities/game.entity.js';

export interface IPossessionSequenceRepository {
  create(data: Omit<PossessionSequence, 'id' | 'createdAt'>): Promise<PossessionSequence>;
  /** Sets end_action_id on the currently open (end_action_id IS NULL) sequence of the game. */
  closeSequence(gameId: string, endActionId: string): Promise<void>;
  findByGame(gameId: string): Promise<PossessionSequence[]>;
}
