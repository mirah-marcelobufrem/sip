import type { Game, StatEvent, LineupSnapshot, StatType } from '../entities/game.entity.js';

export interface IGameRepository {
  findById(id: string): Promise<Game | null>;
  findByTeam(teamId: string, filters?: { status?: string }): Promise<Game[]>;
  create(data: Omit<Game, 'id'>): Promise<Game>;
  update(id: string, data: Partial<Game>): Promise<Game>;
  delete(id: string): Promise<void>;
}

export interface IStatEventRepository {
  findById(id: string): Promise<StatEvent | null>;
  findByGame(gameId: string): Promise<StatEvent[]>;
  findByGameAndPlayer(gameId: string, playerId: string): Promise<StatEvent[]>;
  findByGameAndTeam(gameId: string, teamId: string): Promise<StatEvent[]>;
  findShotEvents(filters: {
    playerId?: string;
    teamId?: string;
    gameId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<StatEvent[]>;
  create(data: Omit<StatEvent, 'id' | 'createdAt'>): Promise<StatEvent>;
  createBatch(events: Omit<StatEvent, 'id' | 'createdAt'>[]): Promise<StatEvent[]>;
  update(id: string, data: Partial<StatEvent>): Promise<StatEvent>;
  softDelete(id: string): Promise<void>;
}

export interface ILineupSnapshotRepository {
  findByGame(gameId: string): Promise<LineupSnapshot[]>;
  findLatestByGameAndTeam(gameId: string, teamId: string): Promise<LineupSnapshot | null>;
  create(data: Omit<LineupSnapshot, 'id'>): Promise<LineupSnapshot>;
  update(id: string, data: Partial<LineupSnapshot>): Promise<LineupSnapshot>;
}
