import { createGame } from '../../../src/application/games/createGame.js';
import type { IGameRepository } from '../../../src/domain/repositories/game.repository.js';
import type { ITournamentRepository } from '../../../src/domain/repositories/tournament.repository.js';
import type { ITeamRepository } from '../../../src/infrastructure/database/repositories/team.repository.js';
import type { Game } from '../../../src/domain/entities/game.entity.js';

const TEAM_ID = '00000000-0000-0000-0000-000000000001';
const FRIENDLY_TOURNAMENT_ID = '00000000-0000-0000-0000-000000000002';
const EXPLICIT_TOURNAMENT_ID = '00000000-0000-0000-0000-000000000003';
const USER_ID = '00000000-0000-0000-0000-000000000004';
const AWAY_TEAM_ID = '00000000-0000-0000-0000-000000000005';
const EXTERNAL_TEAM_ID = '00000000-0000-0000-0000-000000000006';

function makeGameRepo(): IGameRepository {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findByTeam: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(async (data) => ({
      id: 'game-1',
      ...data,
    } as Game)),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function makeTournamentRepo(): ITournamentRepository {
  return {
    findOrCreateFriendlyForTeam: jest.fn().mockResolvedValue({ id: FRIENDLY_TOURNAMENT_ID, name: 'Friendly' }),
    findByTeam: jest.fn().mockResolvedValue([{ id: FRIENDLY_TOURNAMENT_ID, name: 'Friendly' }]),
  };
}

function makeTeamRepo(): ITeamRepository {
  return {
    findById: jest.fn(),
    findByUser: jest.fn(),
    findExternalByUser: jest.fn(),
    findOrCreateExternalByName: jest.fn().mockResolvedValue({ id: EXTERNAL_TEAM_ID, name: 'Unknown Opponent' }),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  } as unknown as ITeamRepository;
}

describe('createGame', () => {
  it('uses the explicit tournamentId when provided and does not create a Friendly tournament', async () => {
    const gameRepo = makeGameRepo();
    const tournamentRepo = makeTournamentRepo();
    const teamRepo = makeTeamRepo();

    const game = await createGame(
      { teamId: TEAM_ID, userId: USER_ID, awayTeamId: AWAY_TEAM_ID, tournamentId: EXPLICIT_TOURNAMENT_ID },
      gameRepo,
      tournamentRepo,
      teamRepo,
    );

    expect(tournamentRepo.findOrCreateFriendlyForTeam).not.toHaveBeenCalled();
    expect(gameRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tournamentId: EXPLICIT_TOURNAMENT_ID, awayTeamId: AWAY_TEAM_ID }),
    );
    expect(game.tournamentId).toBe(EXPLICIT_TOURNAMENT_ID);
  });

  it('falls back to the team Friendly tournament when no tournamentId is provided', async () => {
    const gameRepo = makeGameRepo();
    const tournamentRepo = makeTournamentRepo();
    const teamRepo = makeTeamRepo();

    const game = await createGame(
      { teamId: TEAM_ID, userId: USER_ID, awayTeamId: AWAY_TEAM_ID },
      gameRepo,
      tournamentRepo,
      teamRepo,
    );

    expect(tournamentRepo.findOrCreateFriendlyForTeam).toHaveBeenCalledWith(TEAM_ID);
    expect(gameRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tournamentId: FRIENDLY_TOURNAMENT_ID }),
    );
    expect(game.tournamentId).toBe(FRIENDLY_TOURNAMENT_ID);
  });

  it('R2 — find-or-creates an external away team when only a name is given', async () => {
    const gameRepo = makeGameRepo();
    const tournamentRepo = makeTournamentRepo();
    const teamRepo = makeTeamRepo();

    const game = await createGame(
      { teamId: TEAM_ID, userId: USER_ID, awayTeamName: 'River Rivals' },
      gameRepo,
      tournamentRepo,
      teamRepo,
    );

    expect(teamRepo.findOrCreateExternalByName).toHaveBeenCalledWith('River Rivals', USER_ID);
    expect(gameRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ homeTeamId: TEAM_ID, awayTeamId: EXTERNAL_TEAM_ID }),
    );
    expect(game.awayTeamId).toBe(EXTERNAL_TEAM_ID);
  });

  it('R2 — defaults to an "Unknown Opponent" external team when no away info is given', async () => {
    const gameRepo = makeGameRepo();
    const tournamentRepo = makeTournamentRepo();
    const teamRepo = makeTeamRepo();

    await createGame({ teamId: TEAM_ID, userId: USER_ID }, gameRepo, tournamentRepo, teamRepo);

    expect(teamRepo.findOrCreateExternalByName).toHaveBeenCalledWith('Unknown Opponent', USER_ID);
  });

  it('rejects an invalid format value the same way the old inline schema did', async () => {
    const gameRepo = makeGameRepo();
    const tournamentRepo = makeTournamentRepo();
    const teamRepo = makeTeamRepo();

    await expect(
      createGame(
        { teamId: TEAM_ID, userId: USER_ID, awayTeamId: AWAY_TEAM_ID, format: 'invalid-format' as unknown as 'quarters' },
        gameRepo,
        tournamentRepo,
        teamRepo,
      ),
    ).rejects.toThrow();

    expect(gameRepo.create).not.toHaveBeenCalled();
  });
});
