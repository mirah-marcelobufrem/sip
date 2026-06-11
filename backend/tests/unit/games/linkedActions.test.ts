import { deleteStatEvent } from '../../../src/application/games/deleteStatEvent.js';
import { attachLinkedChildren } from '../../../src/domain/stat-calculators.js';
import type { IStatEventRepository } from '../../../src/domain/repositories/game.repository.js';
import type { StatEvent } from '../../../src/domain/entities/game.entity.js';

const GAME_ID = '00000000-0000-0000-0000-000000000001';
const TEAM_ID = '00000000-0000-0000-0000-000000000002';
const FOUL_ID = '00000000-0000-0000-0000-000000000010';
const DFD_ID = '00000000-0000-0000-0000-000000000011';
const MISS_ID = '00000000-0000-0000-0000-000000000020';
const REB_ID = '00000000-0000-0000-0000-000000000021';

function makeEvent(overrides: Partial<StatEvent>): StatEvent {
  return {
    id: FOUL_ID,
    gameId: GAME_ID,
    period: 1,
    clockTimeSeconds: 300,
    playerId: null,
    teamId: TEAM_ID,
    statType: 'PF',
    value: 1,
    xCourt: null,
    yCourt: null,
    lineupSnapshotId: null,
    seq: null,
    linkedActionId: null,
    linkRole: null,
    waveSubGroupId: null,
    isTeamRebound: false,
    isBenchFoul: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeStatRepo(overrides: Partial<IStatEventRepository> = {}): IStatEventRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByGame: jest.fn().mockResolvedValue([]),
    findByGameAndPeriod: jest.fn().mockResolvedValue([]),
    findByGameAndPlayer: jest.fn().mockResolvedValue([]),
    findByGameAndTeam: jest.fn().mockResolvedValue([]),
    findByPlayer: jest.fn().mockResolvedValue([]),
    findByLinkedAction: jest.fn().mockResolvedValue([]),
    findShotEvents: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    createBatch: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    softDelete: jest.fn(),
    ...overrides,
  };
}

describe('deleteStatEvent (linked action cascade)', () => {
  it('deleting a foul also deletes its linked DFD child', async () => {
    const foul = makeEvent({ id: FOUL_ID, statType: 'PF' });
    const dfd = makeEvent({
      id: DFD_ID,
      statType: 'DFD',
      linkedActionId: FOUL_ID,
      linkRole: 'foul_drawn',
    });

    const repo = makeStatRepo({
      findById: jest.fn().mockResolvedValue(foul),
      findByLinkedAction: jest.fn().mockResolvedValue([dfd]),
    });

    const result = await deleteStatEvent({ gameId: GAME_ID, eventId: FOUL_ID }, repo);

    expect(result.deletedIds).toEqual([DFD_ID, FOUL_ID]);
    expect(repo.softDelete).toHaveBeenNthCalledWith(1, DFD_ID); // children first
    expect(repo.softDelete).toHaveBeenNthCalledWith(2, FOUL_ID);
  });

  it('deleting a missed shot with a linked rebound also deletes the rebound', async () => {
    const miss = makeEvent({ id: MISS_ID, statType: '2PA' });
    const rebound = makeEvent({
      id: REB_ID,
      statType: 'DREB',
      linkedActionId: MISS_ID,
      linkRole: 'rebound_after_miss',
    });

    const repo = makeStatRepo({
      findById: jest.fn().mockResolvedValue(miss),
      findByLinkedAction: jest.fn().mockResolvedValue([rebound]),
    });

    const result = await deleteStatEvent({ gameId: GAME_ID, eventId: MISS_ID }, repo);

    expect(result.deletedIds).toEqual([REB_ID, MISS_ID]);
  });

  it('deletes only the event itself when it has no linked children', async () => {
    const repo = makeStatRepo({
      findById: jest.fn().mockResolvedValue(makeEvent({ id: FOUL_ID })),
    });

    const result = await deleteStatEvent({ gameId: GAME_ID, eventId: FOUL_ID }, repo);

    expect(result.deletedIds).toEqual([FOUL_ID]);
    expect(repo.softDelete).toHaveBeenCalledTimes(1);
  });

  it('throws NOT_FOUND when the event does not belong to the game', async () => {
    const otherGame = '00000000-0000-0000-0000-000000000099';
    const repo = makeStatRepo({
      findById: jest.fn().mockResolvedValue(makeEvent({ gameId: otherGame })),
    });

    await expect(
      deleteStatEvent({ gameId: GAME_ID, eventId: FOUL_ID }, repo),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(repo.softDelete).not.toHaveBeenCalled();
  });
});

describe('attachLinkedChildren (log chain)', () => {
  it('includes linkedActionId, linkRole and linkedChildren in the log payload', () => {
    const steal = makeEvent({ id: FOUL_ID, statType: 'STL' });
    const turnover = makeEvent({
      id: DFD_ID,
      statType: 'TO',
      linkedActionId: FOUL_ID,
      linkRole: 'turnover_after_steal',
    });

    const log = attachLinkedChildren([steal, turnover]);

    const parent = log.find((e) => e.id === FOUL_ID)!;
    const child = log.find((e) => e.id === DFD_ID)!;

    expect(parent.linkedChildren).toEqual([DFD_ID]);
    expect(child.linkedActionId).toBe(FOUL_ID);
    expect(child.linkRole).toBe('turnover_after_steal');
    expect(child.linkedChildren).toEqual([]);
  });
});
