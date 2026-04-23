import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../../lib/api';

interface TeamEntry {
  seed: number;
  teamId?: string;
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

interface Tournament {
  id: string;
  name: string;
  format: string;
  numTeams: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  shareToken: string | null;
  teams: TeamEntry[];
  slots: BracketSlot[];
}

const STATUS_OPTIONS = ['upcoming', 'active', 'completed'];

function teamName(seed: number | null, teams: TeamEntry[]): string {
  if (seed === null) return 'TBD';
  return teams.find((t) => t.seed === seed)?.teamName ?? `#${seed}`;
}

function BracketView({ tournament }: { tournament: Tournament }) {
  const { slots, teams } = tournament;
  const maxRound = slots.reduce((max, s) => Math.max(max, s.round), 0);
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {rounds.map((round) => {
          const roundSlots = slots.filter((s) => s.round === round).sort((a, b) => a.position - b.position);
          return (
            <div key={round} className="flex flex-col gap-4">
              <p className="text-xs font-medium text-gray-500 uppercase text-center mb-1">
                Round {round}
              </p>
              {roundSlots.map((slot) => (
                <div key={slot.id} className="w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                    <span className={`text-sm font-medium ${slot.homeSeed ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                      {teamName(slot.homeSeed, teams)}
                    </span>
                    <span className="text-xs text-gray-400">{slot.homeSeed ? `#${slot.homeSeed}` : ''}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className={`text-sm font-medium ${slot.awaySeed ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                      {teamName(slot.awaySeed, teams)}
                    </span>
                    <span className="text-xs text-gray-400">{slot.awaySeed ? `#${slot.awaySeed}` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StandingsView({ tournament }: { tournament: Tournament }) {
  const { teams } = tournament;
  const sorted = [...teams].sort((a, b) => {
    const wDiff = (b.wins ?? 0) - (a.wins ?? 0);
    if (wDiff !== 0) return wDiff;
    return a.seed - b.seed;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-2 px-3 font-medium text-gray-500 text-xs uppercase">Team</th>
            <th className="text-center py-2 px-3 font-medium text-gray-500 text-xs uppercase">Seed</th>
            <th className="text-center py-2 px-3 font-medium text-gray-500 text-xs uppercase">W</th>
            <th className="text-center py-2 px-3 font-medium text-gray-500 text-xs uppercase">L</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr key={t.seed} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="py-2 px-3 font-medium text-gray-900 dark:text-gray-100">{t.teamName}</td>
              <td className="py-2 px-3 text-center text-gray-500">#{t.seed}</td>
              <td className="py-2 px-3 text-center text-green-600 font-medium">{t.wins ?? 0}</td>
              <td className="py-2 px-3 text-center text-red-500 font-medium">{t.losses ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Tournament>({
    queryKey: ['tournament', id],
    queryFn: () => api.get(`/tournaments/${id}`),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/tournaments/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  const shareMutation = useMutation({
    mutationFn: (revoke: boolean) =>
      api.post<{ shareToken: string | null }>(`/tournaments/${id}/share`, { revoke }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournament', id] }),
  });

  if (isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (!data) return <div className="p-6 text-red-500">Tournament not found.</div>;

  const isRoundRobin = data.format === 'round_robin';
  const maxRound = data.slots?.reduce((m, s) => Math.max(m, s.round), 0) ?? 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.format.replace(/_/g, ' ')} · {data.numTeams} teams ·{' '}
            {data.startDate && new Date(data.startDate).toLocaleDateString()}
            {data.endDate && ` – ${new Date(data.endDate).toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={data.status}
            onChange={(e) => statusMutation.mutate(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {data.shareToken ? (
            <>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/bracket/${data.shareToken}`)}
                className="text-xs px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 rounded-lg transition-colors"
              >
                Copy share link
              </button>
              <button
                onClick={() => shareMutation.mutate(true)}
                className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Revoke
              </button>
            </>
          ) : (
            <button
              onClick={() => shareMutation.mutate(false)}
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Share
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          {isRoundRobin ? 'Schedule' : 'Bracket'} · {maxRound} round{maxRound !== 1 ? 's' : ''}
        </h2>
        {data.slots && data.slots.length > 0 ? (
          <BracketView tournament={data} />
        ) : (
          <p className="text-sm text-gray-400">No bracket slots generated yet.</p>
        )}
      </div>

      {isRoundRobin && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Standings</h2>
          <StandingsView tournament={data} />
        </div>
      )}
    </div>
  );
}
