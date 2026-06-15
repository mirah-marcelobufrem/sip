import { createGame } from '../../../src/application/games/createGame.js';
import type { IGameRepository } from '../../../src/domain/repositories/game.repository.js';
import type { ITournamentRepository } from '../../../src/domain/repositories/tournament.repository.js';
import type { ITeamRepository } from '../../../src/infrastructure/database/repositories/team.repository.js';
import type { IRosterRepository } from '../../../src/infrastructure/database/repositories/roster.repository.js';
import type { Game } from '../../../src/domain/entities/game.entity.js';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const AWAY_TEAM_ID = '00000000-0000-0000-0000-000000000005';
const USER_ID = '00000000-0000-0000-0000-000000000004';
const HOME_DEFAULT_ROSTER = '00000000-0000-0000-0000-0000000000d1';
const AWAY_DEFAULT_ROSTER = '00000000-0000-0000-0000-0000000000d2';
const EXPLICIT_ROSTER = '00000000-0000-0000-0000-0000000000d3';

function makeGameRepo(): IGameRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByTeam: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(async (data) => ({ id: 'game-1', ...data } as Game)),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makeTournamentRepo(): ITournamentRepository {
  return {
    findOrCreateFriendlyForTeam: jest.fn().mockResolvedValue({ id: 'tour-1', name: 'Friendly' }),
    findByTeam: jest.fn(),
  } as unknown as ITournamentRepository;
}

function makeTeamRepo(): ITeamRepository {
  return {
    findOrCreateExternalByName: jest.fn().mockResolvedValue({ id: AWAY_TEAM_ID, name: 'X' }),
  } as unknown as ITeamRepository;
}

function makeRosterRepo(): IRosterRepository {
  return {
    findDefaultForTeam: jest.fn().mockImplementation(async (teamId: string) =>
      teamId === TEAM_ID ? { id: HOME_DEFAULT_ROSTER }
      : teamId === AWAY_TEAM_ID ? { id: AWAY_DEFAULT_ROSTER }
      : null,
    ),
  } as unknown as IRosterRepository;
}

describe('createGame — U-04 roster defaults', () => {
  it('defaults home/away roster to each team default when not provided', async () => {
    const gameRepo = makeGameRepo();
    const game = await createGame(
      { teamId: TEAM_ID, userId: USER_ID, awayTeamId: AWAY_TEAM_ID },
      gameRepo, makeTournamentRepo(), makeTeamRepo(), makeRosterRepo(),
    );
    expect(gameRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ homeRosterId: HOME_DEFAULT_ROSTER, awayRosterId: AWAY_DEFAULT_ROSTER }),
    );
    expect(game.homeRosterId).toBe(HOME_DEFAULT_ROSTER);
  });

  it('honours an explicit homeRosterId over the default', async () => {
    const gameRepo = makeGameRepo();
    await createGame(
      { teamId: TEAM_ID, userId: USER_ID, awayTeamId: AWAY_TEAM_ID, homeRosterId: EXPLICIT_ROSTER },
      gameRepo, makeTournamentRepo(), makeTeamRepo(), makeRosterRepo(),
    );
    expect(gameRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ homeRosterId: EXPLICIT_ROSTER }),
    );
  });

  it('leaves rosters null when no roster repo is supplied (back-compat)', async () => {
    const gameRepo = makeGameRepo();
    await createGame(
      { teamId: TEAM_ID, userId: USER_ID, awayTeamId: AWAY_TEAM_ID },
      gameRepo, makeTournamentRepo(), makeTeamRepo(),
    );
    expect(gameRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ homeRosterId: null, awayRosterId: null }),
    );
  });
});
