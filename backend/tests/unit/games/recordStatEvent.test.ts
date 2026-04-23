import { recordStatEvent } from '../../../src/application/games/recordStatEvent.js';
import type { IStatEventRepository, ILineupSnapshotRepository } from '../../../src/domain/repositories/game.repository.js';
import type { StatEvent, LineupSnapshot } from '../../../src/domain/entities/game.entity.js';

const GAME_ID = '00000000-0000-0000-0000-000000000001';
const TEAM_ID = '00000000-0000-0000-0000-000000000002';
const PLAYER_ID = '00000000-0000-0000-0000-000000000003';
const SNAP_ID = '00000000-0000-0000-0000-000000000004';

function makeStatRepo(): IStatEventRepository {
  const stored: StatEvent[] = [];
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByGame: jest.fn().mockResolvedValue(stored),
    findByPlayer: jest.fn().mockResolvedValue(stored),
    findByGameAndPlayer: jest.fn().mockResolvedValue(stored),
    findByGameAndTeam: jest.fn().mockResolvedValue(stored),
    findShotEvents: jest.fn().mockResolvedValue(stored),
    create: jest.fn().mockImplementation(async (data) => ({
      id: 'ev-1',
      ...data,
      createdAt: new Date(),
    } as StatEvent)),
    createBatch: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    softDelete: jest.fn(),
  };
}

function makeLineupRepo(snapshot?: LineupSnapshot): ILineupSnapshotRepository {
  return {
    findByGame: jest.fn().mockResolvedValue([]),
    findLatestByGameAndTeam: jest.fn().mockResolvedValue(snapshot ?? null),
    create: jest.fn().mockResolvedValue({ id: SNAP_ID, playerIds: [] }),
    update: jest.fn(),
  };
}

describe('recordStatEvent', () => {
  it('creates a stat event and links lineup snapshot', async () => {
    const snapshot: LineupSnapshot = {
      id: SNAP_ID,
      gameId: GAME_ID,
      teamId: TEAM_ID,
      period: 1,
      clockTimeSeconds: 600,
      playerIds: [PLAYER_ID],
    };

    const statRepo = makeStatRepo();
    const lineupRepo = makeLineupRepo(snapshot);

    const event = await recordStatEvent(
      { gameId: GAME_ID, period: 1, statType: '2PM', playerId: PLAYER_ID, teamId: TEAM_ID },
      statRepo,
      lineupRepo,
    );

    expect(event.statType).toBe('2PM');
    expect(statRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ lineupSnapshotId: SNAP_ID }),
    );
  });

  it('creates event without lineup when no snapshot exists', async () => {
    const statRepo = makeStatRepo();
    const lineupRepo = makeLineupRepo();

    const event = await recordStatEvent(
      { gameId: GAME_ID, period: 1, statType: 'AST', playerId: PLAYER_ID, teamId: TEAM_ID },
      statRepo,
      lineupRepo,
    );

    expect(event.lineupSnapshotId).toBeNull();
  });

  it('rejects invalid stat types', async () => {
    await expect(
      recordStatEvent(
        { gameId: GAME_ID, period: 1, statType: 'INVALID' as any },
        makeStatRepo(),
        makeLineupRepo(),
      ),
    ).rejects.toThrow();
  });
});
