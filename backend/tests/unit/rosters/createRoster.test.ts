import { createRoster } from '../../../src/application/rosters/createRoster.js';
import { addPlayerToRoster } from '../../../src/application/rosters/addPlayerToRoster.js';
import type { IRosterRepository } from '../../../src/infrastructure/database/repositories/roster.repository.js';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_TEAM_ID = '00000000-0000-0000-0000-000000000002';
const PLAYER_A = '00000000-0000-0000-0000-0000000000a1';
const PLAYER_B = '00000000-0000-0000-0000-0000000000a2';
const FOREIGN_PLAYER = '00000000-0000-0000-0000-0000000000b1';
const ROSTER_ID = '00000000-0000-0000-0000-0000000000c1';
const SOURCE_ROSTER_ID = '00000000-0000-0000-0000-0000000000c2';

// Player → team map drives the R6 check (player must belong to the roster's team).
const PLAYER_TEAMS: Record<string, string> = {
  [PLAYER_A]: TEAM_ID,
  [PLAYER_B]: TEAM_ID,
  [FOREIGN_PLAYER]: OTHER_TEAM_ID,
};

function makeRosterRepo(overrides: Partial<IRosterRepository> = {}): IRosterRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByTeam: jest.fn().mockResolvedValue([]),
    findDefaultForTeam: jest.fn().mockResolvedValue(null),
    getPlayerIds: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(async (data) => ({
      id: ROSTER_ID,
      seasonLabel: null,
      isDefault: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    })),
    update: jest.fn(),
    softDelete: jest.fn(),
    addPlayer: jest.fn(),
    removePlayer: jest.fn(),
    setPlayers: jest.fn(),
    getPlayerTeamId: jest.fn().mockImplementation(async (pid: string) => PLAYER_TEAMS[pid] ?? null),
    ...overrides,
  } as unknown as IRosterRepository;
}

describe('createRoster', () => {
  it('creates a roster and seeds it with the given players', async () => {
    const repo = makeRosterRepo();
    const roster = await createRoster(
      { teamId: TEAM_ID, name: 'Travel Squad', playerIds: [PLAYER_A, PLAYER_B] },
      repo,
    );
    expect(roster.id).toBe(ROSTER_ID);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: TEAM_ID, name: 'Travel Squad', isDefault: false }),
    );
    expect(repo.setPlayers).toHaveBeenCalledWith(ROSTER_ID, [PLAYER_A, PLAYER_B]);
  });

  it('rejects a player from another team (R6)', async () => {
    const repo = makeRosterRepo();
    await expect(
      createRoster({ teamId: TEAM_ID, name: 'Bad', playerIds: [FOREIGN_PLAYER] }, repo),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a non-existent player', async () => {
    const repo = makeRosterRepo();
    await expect(
      createRoster(
        { teamId: TEAM_ID, name: 'Bad', playerIds: ['00000000-0000-0000-0000-0000000000ff'] },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('copies players from a source roster of the same team', async () => {
    const repo = makeRosterRepo({
      findById: jest.fn().mockResolvedValue({ id: SOURCE_ROSTER_ID, teamId: TEAM_ID }),
      getPlayerIds: jest.fn().mockResolvedValue([PLAYER_A, PLAYER_B]),
    });
    await createRoster(
      { teamId: TEAM_ID, name: 'Copy', copyFromRosterId: SOURCE_ROSTER_ID },
      repo,
    );
    expect(repo.setPlayers).toHaveBeenCalledWith(ROSTER_ID, [PLAYER_A, PLAYER_B]);
  });

  it('refuses to copy from a roster belonging to a different team', async () => {
    const repo = makeRosterRepo({
      findById: jest.fn().mockResolvedValue({ id: SOURCE_ROSTER_ID, teamId: OTHER_TEAM_ID }),
    });
    await expect(
      createRoster({ teamId: TEAM_ID, name: 'Copy', copyFromRosterId: SOURCE_ROSTER_ID }, repo),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('addPlayerToRoster', () => {
  it('adds a player that belongs to the roster team', async () => {
    const repo = makeRosterRepo({
      findById: jest.fn().mockResolvedValue({ id: ROSTER_ID, teamId: TEAM_ID }),
    });
    await addPlayerToRoster({ rosterId: ROSTER_ID, playerId: PLAYER_A, teamId: TEAM_ID }, repo);
    expect(repo.addPlayer).toHaveBeenCalledWith(ROSTER_ID, PLAYER_A);
  });

  it('rejects adding a player from another team (R6)', async () => {
    const repo = makeRosterRepo({
      findById: jest.fn().mockResolvedValue({ id: ROSTER_ID, teamId: TEAM_ID }),
    });
    await expect(
      addPlayerToRoster({ rosterId: ROSTER_ID, playerId: FOREIGN_PLAYER, teamId: TEAM_ID }, repo),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repo.addPlayer).not.toHaveBeenCalled();
  });

  it('404s when the roster does not belong to the team', async () => {
    const repo = makeRosterRepo({
      findById: jest.fn().mockResolvedValue({ id: ROSTER_ID, teamId: OTHER_TEAM_ID }),
    });
    await expect(
      addPlayerToRoster({ rosterId: ROSTER_ID, playerId: PLAYER_A, teamId: TEAM_ID }, repo),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
