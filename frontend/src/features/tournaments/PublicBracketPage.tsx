import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

interface TeamEntry {
  seed: number;
  teamName: string;
  wins?: number;
  losses?: number;
}

interface BracketSlot {
  id: string;
  round: number;
  position: number;
  homeSeed: number | null;
  awaySeed: number | null;
  gameId: string | null;
}

interface PublicBracketData {
  tournament: {
    id: string;
    name: string;
    format: string;
    numTeams: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
    teams: TeamEntry[];
  };
  slots: BracketSlot[];
}

function teamName(seed: number | null, teams: TeamEntry[]): string {
  if (seed === null) return 'TBD';
  return teams.find((t) => t.seed === seed)?.teamName ?? `#${seed}`;
}

export default function PublicBracketPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery<PublicBracketData>({
    queryKey: ['public-bracket', token],
    queryFn: async () => {
      const res = await fetch(`/api/v1/share/${token}`);
      if (!res.ok) throw new Error('Not found');
      return res.json() as Promise<PublicBracketData>;
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Loading bracket…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Bracket not found</p>
          <p className="text-gray-500 text-sm">This share link may have been revoked.</p>
        </div>
      </div>
    );
  }

  const { tournament, slots } = data;
  const teams = tournament.teams ?? [];
  const maxRound = slots.reduce((m, s) => Math.max(m, s.round), 0);
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-10 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">{tournament.name}</h1>
          <p className="text-gray-500 text-sm">
            {tournament.format.replace(/_/g, ' ')} · {tournament.numTeams} teams
            {tournament.startDate && ` · ${new Date(tournament.startDate).toLocaleDateString()}`}
            {tournament.endDate && ` – ${new Date(tournament.endDate).toLocaleDateString()}`}
          </p>
          <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full font-medium ${
            tournament.status === 'active' ? 'bg-green-100 text-green-700' :
            tournament.status === 'completed' ? 'bg-gray-100 text-gray-600' :
            'bg-blue-100 text-blue-700'
          }`}>
            {tournament.status}
          </span>
        </div>

        <div className="overflow-x-auto pb-4">
          <div className="flex gap-6 min-w-max">
            {rounds.map((round) => {
              const roundSlots = slots.filter((s) => s.round === round).sort((a, b) => a.position - b.position);
              return (
                <div key={round} className="flex flex-col gap-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase text-center mb-1 tracking-wider">
                    {round === maxRound && maxRound > 1 ? 'Final' : `Round ${round}`}
                  </p>
                  {roundSlots.map((slot) => (
                    <div key={slot.id} className="w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
                        <span className={`text-sm font-medium ${slot.homeSeed ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                          {teamName(slot.homeSeed, teams)}
                        </span>
                        {slot.homeSeed && <span className="text-xs text-gray-400">#{slot.homeSeed}</span>}
                      </div>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className={`text-sm font-medium ${slot.awaySeed ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                          {teamName(slot.awaySeed, teams)}
                        </span>
                        {slot.awaySeed && <span className="text-xs text-gray-400">#{slot.awaySeed}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-12">
          Powered by SIP Scout
        </p>
      </div>
    </div>
  );
}
