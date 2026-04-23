import { recordStatEvent } from '../../../src/application/games/recordStatEvent.js';
import type { IStatEventRepository, ILineupSnapshotRepository } from '../../../src/domain/repositories/game.repository.js';
import type { StatEvent, LineupSnapshot } from '../../../src/domain/entities/game.entity.js';

function makeStatRepo(): IStatEventRepository {
  const stored: StatEvent[] = [];
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByGame: jest.fn().mockResolvedValue(stored),
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
    create: jest.fn().mockResolvedValue({ id: 'snap-1', playerIds: [] }),
    update: jest.fn(),
  };
}

describe('recordStatEvent', () => {
  it('creates a stat event and links lineup snapshot', async () => {
    const snapshot: LineupSnapshot = {
      id: 'snap-1',
      gameId: 'game-1',
      teamId: 'team-1',
      period: 1,
      clockTimeSeconds: 600,
      playerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
    };

    const statRepo = makeStatRepo();
    const lineupRepo = makeLineupRepo(snapshot);

    const event = await recordStatEvent(
      { gameId: 'game-1', period: 1, statType: '2PM', playerId: 'p1', teamId: 'team-1' },
      statRepo,
      lineupRepo,
    );

    expect(event.statType).toBe('2PM');
    expect(statRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ lineupSnapshotId: 'snap-1' }),
    );
  });

  it('creates event without lineup when no snapshot exists', async () => {
    const statRepo = makeStatRepo();
    const lineupRepo = makeLineupRepo();

    const event = await recordStatEvent(
      { gameId: 'game-1', period: 1, statType: 'AST', playerId: 'p1', teamId: 'team-1' },
      statRepo,
      lineupRepo,
    );

    expect(event.lineupSnapshotId).toBeNull();
  });

  it('rejects invalid stat types', async () => {
    await expect(
      recordStatEvent(
        { gameId: 'game-1', period: 1, statType: 'INVALID' as any },
        makeStatRepo(),
        makeLineupRepo(),
      ),
    ).rejects.toThrow();
  });
});
