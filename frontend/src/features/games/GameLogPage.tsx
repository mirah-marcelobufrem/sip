import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface LogEvent {
  id: string;
  period: number;
  clockTimeSeconds: number | null;
  statType: string;
  playerId: string | null;
  teamId: string | null;
  // These fields may be present if the backend joins player data
  playerName?: string | null;
  jerseyNumber?: number | null;
  isHomeTeam?: boolean | null;
}

interface Game {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  format: string;
}

function formatClock(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatPeriod(format: string, period: number): string {
  return format === 'halves' ? `H${period}` : `Q${period}`;
}

export default function GameLogPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const queryClient = useQueryClient();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: game } = useQuery<Game>({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`),
  });

  const { data: events = [], isLoading } = useQuery<LogEvent[]>({
    queryKey: ['game-log', gameId],
    queryFn: () => api.get(`/games/${gameId}/log`),
  });

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => api.delete(`/games/${gameId}/events/${eventId}`),
    onSuccess: () => {
      setDeleteConfirmId(null);
      queryClient.invalidateQueries({ queryKey: ['game-log', gameId] });
    },
  });

  // Group events by period
  const periods = events.reduce<Record<number, LogEvent[]>>((acc, e) => {
    if (!acc[e.period]) acc[e.period] = [];
    acc[e.period].push(e);
    return acc;
  }, {});

  const sortedPeriods = Object.keys(periods)
    .map(Number)
    .sort((a, b) => a - b);

  const gameFormat = game?.format ?? 'quarters';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={`/games/${gameId}/box-score`}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
        >
          Box Score
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Game Log</h1>
      </div>

      {isLoading && <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>}

      {!isLoading && events.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center shadow-card">
          <p className="text-gray-400 text-sm">No events recorded for this game yet.</p>
        </div>
      )}

      {/* Periods accordion */}
      <div className="space-y-3">
        {sortedPeriods.map((periodNum) => {
          const periodEvents = periods[periodNum];
          const label = formatPeriod(gameFormat, periodNum);

          return (
            <details key={periodNum} open className="group">
              <summary className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card cursor-pointer select-none list-none">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{label}</span>
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  {periodEvents.length} events
                </span>
              </summary>

              <div className="mt-1 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-card">
                <table className="w-full text-sm bg-white dark:bg-gray-900">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase w-16">Clock</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Team</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Player</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-2 w-10" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {periodEvents.map((event) => {
                      // Derive home/away from event data or fall back to teamId comparison
                      const isHomeTeam = event.isHomeTeam != null
                        ? event.isHomeTeam
                        : game?.homeTeamId != null && event.teamId === game.homeTeamId;
                      const isAwayTeam = event.isHomeTeam != null
                        ? event.isHomeTeam === false
                        : game?.awayTeamId != null && event.teamId === game.awayTeamId;

                      const rowBg = isHomeTeam
                        ? 'bg-brand-50 dark:bg-brand-900/10'
                        : isAwayTeam
                        ? 'bg-gray-50 dark:bg-gray-900'
                        : '';

                      const playerDisplay = event.playerName
                        ? `#${event.jerseyNumber ?? '?'} ${event.playerName}`
                        : event.playerId
                        ? event.playerId.slice(0, 8)
                        : '—';

                      const teamLabel = isHomeTeam
                        ? 'HOME'
                        : isAwayTeam
                        ? 'AWAY'
                        : '—';

                      return (
                        <tr
                          key={event.id}
                          className={`${rowBg} hover:opacity-90 transition-opacity`}
                        >
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-400 whitespace-nowrap">
                            {formatClock(event.clockTimeSeconds)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {teamLabel}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">
                            {playerDisplay}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono font-semibold text-brand-600 dark:text-brand-400 text-xs">
                              {event.statType}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {/* TODO: Quick-edit (PATCH /games/:gameId/events/:eventId) will be implemented in Sprint S17 */}
                            <button
                              onClick={() => setDeleteConfirmId(event.id)}
                              aria-label="Delete event"
                              className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors text-base leading-none"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-sm shadow-elevated">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Delete this event?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              This cannot be undone.
            </p>
            {deleteMutation.isError && (
              <p className="text-sm text-red-500 mb-3">Failed to delete. Please try again.</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
