import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import ShotChart from '../../components/charts/ShotChart';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string | null;
  heightCm: number | null;
  weightKg: number | null;
  nationality: string | null;
  dominantHand: string | null;
  status: string;
}

interface ShotChartData {
  player: Player;
  shots: {
    id: string;
    x: number | null;
    y: number | null;
    made: boolean;
    isThree: boolean;
    zone: string | null;
  }[];
}

export default function PlayerCardPage() {
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();

  const { data: chartData, isLoading } = useQuery<ShotChartData>({
    queryKey: ['player-shot-chart', teamId, playerId],
    queryFn: () => api.get(`/teams/${teamId}/players/${playerId}/shot-chart`),
  });

  const { data: seasonData } = useQuery<{ box: Record<string, number> | null; derived: Record<string, number | null> | null; gamesPlayed: number }>({
    queryKey: ['player-season', teamId, playerId],
    queryFn: async () => {
      const rows = await api.get<{ player: Player; box: Record<string, number>; derived: Record<string, number | null>; gamesPlayed: number }[]>(
        `/teams/${teamId}/players/season-stats`,
      );
      return rows.find((r) => r.player.id === playerId) ?? { box: null, derived: null, gamesPlayed: 0 };
    },
  });

  const player = chartData?.player;
  const shots = chartData?.shots ?? [];

  if (isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (!player) return <div className="p-6 text-gray-400">Player not found.</div>;

  const box = seasonData?.box;
  const derived = seasonData?.derived;
  const gp = seasonData?.gamesPlayed ?? 0;

  const statCards = box && gp > 0 ? [
    { label: 'PPG', value: ((box.pts ?? 0) / gp).toFixed(1) },
    { label: 'RPG', value: ((box.reb ?? 0) / gp).toFixed(1) },
    { label: 'APG', value: ((box.ast ?? 0) / gp).toFixed(1) },
    { label: 'FG%', value: derived?.fgPct !== null && derived?.fgPct !== undefined ? `${(derived.fgPct * 100).toFixed(1)}%` : '—' },
    { label: 'eFG%', value: derived?.efgPct !== null && derived?.efgPct !== undefined ? `${(derived.efgPct * 100).toFixed(1)}%` : '—' },
    { label: '3P%', value: derived?.threePct !== null && derived?.threePct !== undefined ? `${(derived.threePct * 100).toFixed(1)}%` : '—' },
  ] : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link to={`/teams/${teamId}/players`} className="text-gray-400 hover:text-gray-600 text-sm">← Roster</Link>
      </div>

      {/* Player header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-card flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-2xl font-bold text-brand-600 dark:text-brand-400 shrink-0">
          {player.jerseyNumber !== null ? `#${player.jerseyNumber}` : player.firstName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {player.firstName} {player.lastName}
          </h1>
          <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
            {player.position && <span>{player.position}</span>}
            {player.heightCm && <span>{player.heightCm} cm</span>}
            {player.weightKg && <span>{player.weightKg} kg</span>}
            {player.nationality && <span>{player.nationality}</span>}
            {player.dominantHand && <span>{player.dominantHand === 'R' ? 'Right-handed' : 'Left-handed'}</span>}
          </div>
        </div>
        {gp > 0 && <div className="text-sm text-gray-400 shrink-0">{gp} games</div>}
      </div>

      {/* Stat cards */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 shadow-card text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Shot chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Shot Chart
          {shots.length > 0 && (
            <span className="ml-2 font-normal text-gray-400">
              ({shots.filter((s) => s.made).length}/{shots.length} made)
            </span>
          )}
        </h2>
        {shots.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No shot data recorded yet</p>
        ) : (
          <ShotChart
            shots={shots.map((s) => ({
              x: s.x ?? 0.5,
              y: s.y ?? 0.5,
              made: s.made,
            }))}
          />
        )}
      </div>
    </div>
  );
}
