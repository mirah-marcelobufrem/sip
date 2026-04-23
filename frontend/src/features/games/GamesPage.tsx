import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Game {
  id: string;
  date: string;
  location: string | null;
  status: string;
  finalScoreHome: number | null;
  finalScoreAway: number | null;
  numPeriods: number;
  format: string;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
  live: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20 animate-pulse',
  completed: 'text-gray-500 bg-gray-100 dark:bg-gray-800',
  cancelled: 'text-red-500 bg-red-50 dark:bg-red-900/20',
};

export default function GamesPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [format, setFormat] = useState<'quarters' | 'halves'>('quarters');
  const [numPeriods, setNumPeriods] = useState(4);

  const { data: games = [], isLoading } = useQuery<Game[]>({
    queryKey: ['games', teamId],
    queryFn: () => api.get(`/teams/${teamId}/games`),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post(`/teams/${teamId}/games`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['games', teamId] });
      setShowCreate(false);
      setDate('');
      setLocation('');
      setFormat('quarters');
      setNumPeriods(4);
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Games</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
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
                <p className="text-xs text-gray-400 mt-0.5">{g.format === 'halves' ? '2 halves' : `${g.numPeriods}Q`}</p>
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
                    to={`/games/${g.id}/box-score`}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
                  >
                    Box Score
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

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">New Game</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({
                  date: date ? new Date(date).toISOString() : undefined,
                  location: location || undefined,
                  format,
                  numPeriods,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date & time</label>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Gym / arena name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Format</label>
                <select
                  value={format}
                  onChange={(e) => {
                    const v = e.target.value as 'quarters' | 'halves';
                    setFormat(v);
                    setNumPeriods(v === 'halves' ? 2 : 4);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="quarters">Quarters (4)</option>
                  <option value="halves">Halves (2)</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Game'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
