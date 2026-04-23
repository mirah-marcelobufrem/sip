import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SeasonStats {
  wins: number;
  losses: number;
  pointsPerGame: number;
  pointsAllowedPerGame: number;
  teamFgPct: number | null;
}

export default function AnalyticsDashboard() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data, isLoading } = useQuery<SeasonStats>({
    queryKey: ['season-stats', teamId],
    queryFn: () => api.get(`/teams/${teamId}/season-stats`),
  });

  if (isLoading) return <div className="p-6 text-gray-500">Loading analytics…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Season Analytics</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Record', value: data ? `${data.wins}–${data.losses}` : '—' },
          { label: 'PPG', value: data?.pointsPerGame?.toFixed(1) ?? '—' },
          { label: 'OPP PPG', value: data?.pointsAllowedPerGame?.toFixed(1) ?? '—' },
          { label: 'FG%', value: data?.teamFgPct ? `${(data.teamFgPct * 100).toFixed(1)}%` : '—' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Points Per Game — Season Trend</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="game" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="pts" stroke="#1a56db" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-400 text-center mt-2">Play some games to see trend data</p>
      </div>
    </div>
  );
}
