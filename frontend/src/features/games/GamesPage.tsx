import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Game {
  id: string;
  date: string;
  location: string | null;
  status: string;
  finalScoreHome: number | null;
  finalScoreAway: number | null;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
  live: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20 animate-pulse',
  completed: 'text-gray-500 bg-gray-100 dark:bg-gray-800',
  cancelled: 'text-red-500 bg-red-50 dark:bg-red-900/20',
};

export default function GamesPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: games = [], isLoading } = useQuery<Game[]>({
    queryKey: ['games', teamId],
    queryFn: () => api.get(`/teams/${teamId}/games`),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Games</h1>
        <button className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors">
          + New Game
        </button>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="space-y-3">
        {games.map((g) => (
          <div key={g.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{new Date(g.date).toLocaleDateString()}</p>
                {g.location && <p className="text-xs text-gray-400">{g.location}</p>}
              </div>
              {g.finalScoreHome !== null && (
                <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {g.finalScoreHome} — {g.finalScoreAway}
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[g.status] ?? ''}`}>
                  {g.status}
                </span>
                {g.status === 'scheduled' || g.status === 'live' ? (
                  <Link
                    to={`/games/${g.id}/live`}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    {g.status === 'live' ? 'Resume' : 'Start'}
                  </Link>
                ) : (
                  <Link
                    to={`/games/${g.id}/live`}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
                  >
                    View
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
        {games.length === 0 && !isLoading && (
          <p className="text-center text-gray-400 py-10">No games yet. Create your first game.</p>
        )}
      </div>
    </div>
  );
}
