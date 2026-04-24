import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../../lib/api';
import { ShotChart } from '../../components/charts/ShotChart';
import { RadarChart } from '../../components/charts/RadarChart';

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

interface Report {
  id: string;
  overallRating: number | null;
  skillRatings: Record<string, number> | null;
}

interface DevEntry {
  id: string;
  date: string;
  category: string;
  metricName: string;
  metricValue: number | null;
  notes: string | null;
}

const SKILL_LABELS: Record<string, string> = {
  scoring: 'Scoring',
  ballHandling: 'Ball Hdlg',
  passing: 'Passing',
  offBallMovement: 'Off-Ball',
  defenseOnBall: 'Def (On)',
  defenseHelp: 'Def (Help)',
  rebounding: 'Rebounding',
  athleticism: 'Athleticism',
  basketballIq: 'IQ',
  clutch: 'Clutch',
};

export default function PlayerCardPage() {
  const { teamId, playerId } = useParams<{ teamId: string; playerId: string }>();
  const [devInsights, setDevInsights] = useState<string | null>(null);

  const insightsMutation = useMutation({
    mutationFn: () => api.post<{ insights: string }>(`/ai/development-insights/${playerId}`, {}),
    onSuccess: (data) => setDevInsights(data.insights),
  });

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

  const { data: reports = [] } = useQuery<Report[]>({
    queryKey: ['scouting-reports'],
    queryFn: () => api.get('/scouting-reports'),
    select: (data) => data.filter((r) => r.skillRatings !== null),
  });

  const { data: devEntries = [] } = useQuery<DevEntry[]>({
    queryKey: ['dev-entries', playerId],
    queryFn: () => api.get(`/players/${playerId}/development`),
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
    { label: 'SPG', value: ((box.stl ?? 0) / gp).toFixed(1) },
    { label: 'BPG', value: ((box.blk ?? 0) / gp).toFixed(1) },
    { label: 'FG%', value: derived?.fgPct != null ? `${(derived.fgPct * 100).toFixed(1)}%` : '—' },
    { label: 'eFG%', value: derived?.efgPct != null ? `${(derived.efgPct * 100).toFixed(1)}%` : '—' },
    { label: '3P%', value: derived?.threePct != null ? `${(derived.threePct * 100).toFixed(1)}%` : '—' },
  ] : [];

  // Average skill ratings across all reports that have ratings
  const avgSkills = Object.keys(SKILL_LABELS).map((key) => {
    const vals = reports.map((r) => r.skillRatings?.[key]).filter((v): v is number => v != null);
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { label: SKILL_LABELS[key], value: Math.round(avg * 10) / 10 };
  });

  const hasSkillData = avgSkills.some((a) => a.value > 0);

  // Development trend — group entries by metricName, show first 3 metrics chronologically
  const devByMetric = devEntries.reduce<Record<string, DevEntry[]>>((acc, e) => {
    if (!acc[e.metricName]) acc[e.metricName] = [];
    acc[e.metricName].push(e);
    return acc;
  }, {});
  const topMetrics = Object.entries(devByMetric)
    .filter(([, entries]) => entries.length > 1)
    .slice(0, 2);

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
        <div className="flex flex-col items-end gap-2 shrink-0">
          {gp > 0 && <div className="text-sm text-gray-400">{gp} games</div>}
          <div className="flex gap-2">
            <a
              href={`/api/v1/export/player/${playerId}/card/pdf`}
              download
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg"
            >
              Export PDF
            </a>
            <button
              onClick={() => insightsMutation.mutate()}
              disabled={insightsMutation.isPending}
              className="text-xs px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 rounded-lg disabled:opacity-60"
            >
              {insightsMutation.isPending ? 'Analyzing…' : 'AI Insights'}
            </button>
          </div>
        </div>
      </div>

      {devInsights && (
        <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider">AI Development Insights</p>
            <button onClick={() => setDevInsights(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{devInsights}</p>
        </div>
      )}

      {/* Stat cards */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 shadow-card text-center">
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{s.value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Skill radar + shot chart side-by-side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Skill radar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Skill Ratings</h2>
          {hasSkillData ? (
            <div className="flex justify-center">
              <RadarChart axes={avgSkills} size={220} />
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8 text-sm">No scouting reports with skill ratings yet</p>
          )}
          {reports.length > 0 && (
            <p className="text-center text-xs text-gray-400 mt-2">Averaged from {reports.length} report{reports.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Shot chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                type: (s.isThree ? (s.made ? '3PM' : '3PA') : (s.made ? '2PM' : '2PA')) as '2PM' | '2PA' | '3PM' | '3PA',
              }))}
            />
          )}
        </div>
      </div>

      {/* Development trend charts */}
      {topMetrics.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Development Trends</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {topMetrics.map(([metric, entries]) => {
              const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              const data = sorted.map((e) => ({
                date: new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                value: e.metricValue,
              }));
              return (
                <div key={metric}>
                  <p className="text-xs font-medium text-gray-500 mb-2 capitalize">{metric}</p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} domain={['auto', 'auto']} />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke="#1a56db" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
