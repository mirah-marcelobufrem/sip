export interface ITournamentRepository {
  findOrCreateFriendlyForTeam(teamId: string): Promise<{ id: string; name: string }>;
  findByTeam(teamId: string): Promise<{ id: string; name: string }[]>;
}
