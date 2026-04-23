import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface BoxRow {
  playerId: string;
  pts: number;
  fgm: number;
  fga: number;
  fgPct: number | null;
  threepm: number;
  threepa: number;
  threePct: number | null;
  ftm: number;
  fta: number;
  ftPct: number | null;
  reb: number;
  ast: number;
  to: number;
  stl: number;
  blk: number;
  pf: number;
  efgPct: number | null;
  plusMinus: number;
}

interface Game {
  id: string;
  date: string;
  location: string | null;
  status: string;
  finalScoreHome: number | null;
  finalScoreAway: number | null;
  homeTeamId: string | null;
}

function fmt(n: number | null, decimals = 1): string {
  if (n === null) return '—';
  return (n * 100).toFixed(decimals) + '%';
}

export default function BoxScorePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [recap, setRecap] = useState<string | null>(null);
  const [recapStyle, setRecapStyle] = useState<'formal' | 'casual' | 'social'>('casual');

  const recapMutation = useMutation({
    mutationFn: () => api.post<{ recap: string }>(`/ai/game-recap/${gameId}`, { style: recapStyle }),
    onSuccess: (data) => setRecap(data.recap),
  });

  const { data: game } = useQuery<Game>({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`),
  });

  const { data: boxRows = [], isLoading } = useQuery<BoxRow[]>({
    queryKey: ['box-score', gameId],
    queryFn: () => api.get(`/games/${gameId}/box-score`),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={-1 as never} className="text-gray-400 hover:text-gray-600 text-sm">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Box Score</h1>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <a
              href={`/api/v1/export/game/${gameId}/csv`}
              download
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Export CSV
            </a>
            <a
              href={`/api/v1/export/game/${gameId}/json`}
              download
              className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Export JSON
            </a>
            <select
              value={recapStyle}
              onChange={(e) => setRecapStyle(e.target.value as typeof recapStyle)}
              className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none"
            >
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
              <option value="social">Social media</option>
            </select>
            <button
              onClick={() => recapMutation.mutate()}
              disabled={recapMutation.isPending}
              className="text-xs px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 rounded-lg transition-colors disabled:opacity-60"
            >
              {recapMutation.isPending ? 'Generating…' : 'AI Game Recap'}
            </button>
          </div>
          {game && (
            <p className="text-sm text-gray-500">
              {new Date(game.date).toLocaleDateString()}
              {game.location ? ` · ${game.location}` : ''}
              {game.finalScoreHome !== null ? ` · ${game.finalScoreHome}–${game.finalScoreAway}` : ''}
            </p>
          )}
        </div>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      {recap && (
        <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider">AI Game Recap</p>
            <button onClick={() => setRecap(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{recap}</p>
        </div>
      )}

      {recapMutation.isError && (
        <p className="text-sm text-red-500 mb-4">Failed to generate recap. Check that ANTHROPIC_API_KEY is configured.</p>
      )}

      {boxRows.length === 0 && !isLoading && (
        <p className="text-center text-gray-400 py-10">No stats recorded for this game yet.</p>
      )}

      {boxRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 dark:bg-gray-800">Player</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">PTS</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">FG</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">FG%</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">3P</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">3P%</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">FT</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">FT%</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">REB</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">AST</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">TO</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">STL</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">BLK</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">PF</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">eFG%</th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">+/-</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {boxRows
                .sort((a, b) => b.pts - a.pts)
                .map((row) => (
                  <tr key={row.playerId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 sticky left-0 bg-white dark:bg-gray-900">
                      {row.playerId.slice(0, 8)}…
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-gray-900 dark:text-gray-100">{row.pts}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{row.fgm}/{row.fga}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{fmt(row.fgPct)}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{row.threepm}/{row.threepa}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{fmt(row.threePct)}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{row.ftm}/{row.fta}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{fmt(row.ftPct)}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{row.reb}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{row.ast}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{row.to}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{row.stl}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{row.blk}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{row.pf}</td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">{fmt(row.efgPct)}</td>
                    <td className={`px-3 py-3 text-center font-medium ${row.plusMinus > 0 ? 'text-green-600' : row.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {row.plusMinus > 0 ? `+${row.plusMinus}` : row.plusMinus}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
