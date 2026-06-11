import { recordStatEvent } from '../../../src/application/games/recordStatEvent.js';
import type { IGameRepository, IStatEventRepository, ILineupSnapshotRepository } from '../../../src/domain/repositories/game.repository.js';
import type { IPossessionSequenceRepository } from '../../../src/domain/repositories/possession.repository.js';
import type { Game, StatEvent, LineupSnapshot } from '../../../src/domain/entities/game.entity.js';

const GAME_ID = '00000000-0000-0000-0000-000000000001';
const TEAM_ID = '00000000-0000-0000-0000-000000000002';
const PLAYER_ID = '00000000-0000-0000-0000-000000000003';
const SNAP_ID = '00000000-0000-0000-0000-000000000004';
const AWAY_TEAM_ID = '00000000-0000-0000-0000-000000000005';
const FOUL_EVENT_ID = '00000000-0000-0000-0000-000000000006';

function makeStatRepo(): IStatEventRepository {
  const stored: StatEvent[] = [];
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByGame: jest.fn().mockResolvedValue(stored),
    findByGameAndPeriod: jest.fn().mockResolvedValue(stored),
    findByPlayer: jest.fn().mockResolvedValue(stored),
    findByGameAndPlayer: jest.fn().mockResolvedValue(stored),
    findByGameAndTeam: jest.fn().mockResolvedValue(stored),
    findByLinkedAction: jest.fn().mockResolvedValue([]),
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

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: GAME_ID,
    homeTeamId: TEAM_ID,
    awayTeamId: AWAY_TEAM_ID,
    homeOpponentTeamId: null,
    awayOpponentTeamId: null,
    date: new Date(),
    location: null,
    format: 'quarters',
    numPeriods: 4,
    periodDurationMinutes: 10,
    foulLimitBonus: 5,
    threePointEnabled: true,
    currentPeriod: 1,
    status: 'live',
    finalScoreHome: null,
    finalScoreAway: null,
    notes: null,
    currentPossessionTeamId: TEAM_ID,
    possessionArrowTeamId: AWAY_TEAM_ID,
    tournamentId: null,
    ...overrides,
  };
}

function makeGameRepo(game: Game = makeGame()): IGameRepository {
  return {
    findById: jest.fn().mockResolvedValue(game),
    findByTeam: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn().mockImplementation(async (_id, data) => ({ ...game, ...data })),
    delete: jest.fn(),
  };
}

function makePossessionRepo(): IPossessionSequenceRepository {
  return {
    create: jest.fn().mockImplementation(async (data) => ({
      id: '00000000-0000-0000-0000-000000000099',
      ...data,
      createdAt: new Date(),
    })),
    closeSequence: jest.fn(),
    findByGame: jest.fn().mockResolvedValue([]),
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

  it('switches possession to the opponent and rotates sequences on a made shot', async () => {
    const gameRepo = makeGameRepo();
    const possessionRepo = makePossessionRepo();

    const event = await recordStatEvent(
      { gameId: GAME_ID, period: 1, statType: '2PM', playerId: PLAYER_ID, teamId: TEAM_ID },
      makeStatRepo(),
      makeLineupRepo(),
      gameRepo,
      possessionRepo,
    );

    expect(possessionRepo.closeSequence).toHaveBeenCalledWith(GAME_ID, event.id);
    expect(possessionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ gameId: GAME_ID, teamId: AWAY_TEAM_ID, startActionId: event.id }),
    );
    expect(gameRepo.update).toHaveBeenCalledWith(GAME_ID, {
      currentPossessionTeamId: AWAY_TEAM_ID,
      possessionArrowTeamId: AWAY_TEAM_ID,
    });
  });

  it('does not touch possession when the event keeps the same possession', async () => {
    const gameRepo = makeGameRepo();
    const possessionRepo = makePossessionRepo();

    await recordStatEvent(
      { gameId: GAME_ID, period: 1, statType: 'OREB', playerId: PLAYER_ID, teamId: TEAM_ID },
      makeStatRepo(),
      makeLineupRepo(),
      gameRepo,
      possessionRepo,
    );

    expect(possessionRepo.closeSequence).not.toHaveBeenCalled();
    expect(possessionRepo.create).not.toHaveBeenCalled();
    expect(gameRepo.update).not.toHaveBeenCalled();
  });

  it('auto-links a DFD recorded with a linkedActionId as foul_drawn', async () => {
    const statRepo = makeStatRepo();

    await recordStatEvent(
      {
        gameId: GAME_ID,
        period: 1,
        statType: 'DFD',
        playerId: PLAYER_ID,
        teamId: TEAM_ID,
        linkedActionId: FOUL_EVENT_ID,
      },
      statRepo,
      makeLineupRepo(),
    );

    expect(statRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ linkedActionId: FOUL_EVENT_ID, linkRole: 'foul_drawn' }),
    );
  });

  it('persists an explicitly provided linkRole', async () => {
    const statRepo = makeStatRepo();

    await recordStatEvent(
      {
        gameId: GAME_ID,
        period: 1,
        statType: 'DREB',
        playerId: PLAYER_ID,
        teamId: TEAM_ID,
        linkedActionId: FOUL_EVENT_ID,
        linkRole: 'rebound_after_miss',
      },
      statRepo,
      makeLineupRepo(),
    );

    expect(statRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ linkedActionId: FOUL_EVENT_ID, linkRole: 'rebound_after_miss' }),
    );
  });

  it('rejects a team rebound that carries a playerId (BR-STAT-4.3)', async () => {
    await expect(
      recordStatEvent(
        {
          gameId: GAME_ID,
          period: 1,
          statType: 'DREB',
          teamId: TEAM_ID,
          playerId: PLAYER_ID,
          isTeamRebound: true,
        },
        makeStatRepo(),
        makeLineupRepo(),
      ),
    ).rejects.toThrow(/team rebound/i);
  });

  it('persists a team rebound without a playerId', async () => {
    const statRepo = makeStatRepo();

    await recordStatEvent(
      { gameId: GAME_ID, period: 1, statType: 'DREB', teamId: TEAM_ID, isTeamRebound: true },
      statRepo,
      makeLineupRepo(),
    );

    expect(statRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isTeamRebound: true, playerId: null }),
    );
  });

  it('accepts an explicit playerId: null for a team rebound (live UI payload)', async () => {
    const statRepo = makeStatRepo();

    await recordStatEvent(
      {
        gameId: GAME_ID,
        period: 1,
        statType: 'OREB',
        teamId: TEAM_ID,
        playerId: null,
        isTeamRebound: true,
      },
      statRepo,
      makeLineupRepo(),
    );

    expect(statRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isTeamRebound: true, playerId: null }),
    );
  });

  it('persists isBenchFoul for a coach technical foul', async () => {
    const statRepo = makeStatRepo();

    await recordStatEvent(
      { gameId: GAME_ID, period: 1, statType: 'TF', teamId: TEAM_ID, isBenchFoul: true },
      statRepo,
      makeLineupRepo(),
    );

    expect(statRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ isBenchFoul: true }),
    );
  });

  it('warns (without failing) when statType does not match the court location', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // storage-frame (0.5, 0.7) is beyond the 3pt arc — a 2PM there is a mismatch
    const event = await recordStatEvent(
      { gameId: GAME_ID, period: 1, statType: '2PM', playerId: PLAYER_ID, teamId: TEAM_ID, xCourt: 0.5, yCourt: 0.7 },
      makeStatRepo(),
      makeLineupRepo(),
    );

    expect(event.statType).toBe('2PM');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
