import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

type StatType =
  | '2PM' | '2PA' | '3PM' | '3PA' | 'FTM' | 'FTA'
  | 'OREB' | 'DREB' | 'AST' | 'TO' | 'STL' | 'BLK'
  | 'PF' | 'TF';

interface StatEvent {
  id: string;
  period: number;
  clockTimeSeconds: number | null;
  playerId: string | null;
  teamId: string | null;
  statType: StatType;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  teamId: string;
}

interface Game {
  id: string;
  homeTeamId: string | null;
  status: string;
  currentPeriod: number;
  numPeriods: number;
  format: string;
  finalScoreHome: number | null;
  finalScoreAway: number | null;
}

const STAT_BUTTONS: { type: StatType; label: string; color: string; pts?: number }[] = [
  { type: '2PM', label: '2 Made', color: 'bg-green-500 hover:bg-green-600', pts: 2 },
  { type: '2PA', label: '2 Miss', color: 'bg-red-400 hover:bg-red-500' },
  { type: '3PM', label: '3 Made', color: 'bg-green-600 hover:bg-green-700', pts: 3 },
  { type: '3PA', label: '3 Miss', color: 'bg-red-500 hover:bg-red-600' },
  { type: 'FTM', label: 'FT Made', color: 'bg-blue-500 hover:bg-blue-600', pts: 1 },
  { type: 'FTA', label: 'FT Miss', color: 'bg-blue-400 hover:bg-blue-500' },
  { type: 'OREB', label: 'OReb', color: 'bg-orange-500 hover:bg-orange-600' },
  { type: 'DREB', label: 'DReb', color: 'bg-orange-400 hover:bg-orange-500' },
  { type: 'AST', label: 'Assist', color: 'bg-purple-500 hover:bg-purple-600' },
  { type: 'TO', label: 'Turnover', color: 'bg-yellow-600 hover:bg-yellow-700' },
  { type: 'STL', label: 'Steal', color: 'bg-teal-500 hover:bg-teal-600' },
  { type: 'BLK', label: 'Block', color: 'bg-teal-600 hover:bg-teal-700' },
  { type: 'PF', label: 'Foul', color: 'bg-gray-600 hover:bg-gray-700' },
  { type: 'TF', label: 'Tech Foul', color: 'bg-gray-700 hover:bg-gray-800' },
];

export default function LiveRecordingPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedStat, setSelectedStat] = useState<StatType | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const undoStack = useRef<string[]>([]);

  const { data: game } = useQuery<Game>({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`),
  });

  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ['players', game?.homeTeamId],
    queryFn: () => api.get(`/teams/${game!.homeTeamId}/players`),
    enabled: !!game?.homeTeamId,
  });

  const { data: events = [] } = useQuery<StatEvent[]>({
    queryKey: ['game-log', gameId],
    queryFn: () => api.get(`/games/${gameId}/log`),
    refetchInterval: 5000,
  });

  const homePts = events.reduce((acc, e) => {
    if (e.teamId !== game?.homeTeamId) return acc;
    if (e.statType === '2PM') return acc + 2;
    if (e.statType === '3PM') return acc + 3;
    if (e.statType === 'FTM') return acc + 1;
    return acc;
  }, 0);

  const period = game?.currentPeriod ?? 1;

  const startMutation = useMutation({
    mutationFn: () => api.post(`/games/${gameId}/start`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', gameId] }),
  });

  const recordMutation = useMutation({
    mutationFn: (payload: { playerId: string; teamId: string }) =>
      api.post<StatEvent>(`/games/${gameId}/events`, {
        period,
        statType: selectedStat,
        playerId: payload.playerId,
        teamId: payload.teamId,
      }),
    onSuccess: (event) => {
      undoStack.current = [event.id, ...undoStack.current.slice(0, 19)];
      setSelectedStat(null);
      queryClient.invalidateQueries({ queryKey: ['game-log', gameId] });
    },
  });

  const undoMutation = useMutation({
    mutationFn: (eventId: string) => api.delete(`/games/${gameId}/events/${eventId}`),
    onSuccess: () => {
      undoStack.current = undoStack.current.slice(1);
      queryClient.invalidateQueries({ queryKey: ['game-log', gameId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/games/${gameId}/complete`, { finalScoreHome: homePts, finalScoreAway: 0 }),
    onSuccess: () => navigate(-1),
  });

  const handleStatSelect = useCallback((stat: StatType) => {
    setSelectedStat((prev) => (prev === stat ? null : stat));
  }, []);

  const handleUndo = useCallback(() => {
    const lastId = undoStack.current[0];
    if (lastId) undoMutation.mutate(lastId);
  }, [undoMutation]);

  const activePlayers = players.filter((p) => (p as Player & { status?: string }).status === 'active' || !(p as Player & { status?: string }).status);

  if (game?.status === 'scheduled') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white gap-4">
        <p className="text-lg text-gray-300">Game not started yet</p>
        <button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 rounded-xl font-bold text-lg disabled:opacity-60"
        >
          {startMutation.isPending ? 'Starting…' : 'Start Game'}
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white select-none">
      {/* Score bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="text-center">
          <div className="text-3xl font-bold tabular-nums">{homePts}</div>
          <div className="text-xs text-gray-400">HOME</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-300">
            {game?.format === 'halves' ? `H${period}` : `Q${period}`}
          </div>
          <div className="text-xs text-gray-500">{game?.numPeriods} {game?.format}</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold tabular-nums">—</div>
          <div className="text-xs text-gray-400">AWAY</div>
        </div>
        <button
          onClick={() => completeMutation.mutate()}
          disabled={completeMutation.isPending}
          className="text-xs px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded-lg"
        >
          End
        </button>
      </div>

      {selectedStat && (
        <div className="bg-brand-600 text-center py-2 text-sm font-semibold">
          TAP A PLAYER — Recording: {selectedStat}
        </div>
      )}

      {/* Player lineup */}
      <div className="p-2 grid grid-cols-5 gap-2 bg-gray-850 border-b border-gray-700">
        {activePlayers.slice(0, 10).map((p) => (
          <button
            key={p.id}
            onClick={() => {
              if (selectedStat) {
                recordMutation.mutate({ playerId: p.id, teamId: p.teamId });
              }
            }}
            className={`flex flex-col items-center py-2 px-1 rounded-lg text-center transition-all ${
              selectedStat
                ? 'bg-brand-600 hover:bg-brand-500 ring-2 ring-brand-400 animate-pulse'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <span className="text-xl font-bold">#{p.jerseyNumber ?? '?'}</span>
            <span className="text-xs text-gray-300 truncate w-full text-center">{p.lastName}</span>
          </button>
        ))}
        {activePlayers.length === 0 && (
          <div className="col-span-5 text-center text-gray-500 py-3 text-xs">
            No active players — add players to the roster first
          </div>
        )}
      </div>

      {/* Stat buttons grid */}
      <div className="flex-1 p-3 grid grid-cols-4 gap-2 content-start overflow-auto">
        {STAT_BUTTONS.map((btn) => (
          <button
            key={btn.type}
            onClick={() => handleStatSelect(btn.type)}
            className={`py-4 rounded-xl font-bold text-sm text-white transition-all active:scale-95 ${btn.color} ${
              selectedStat === btn.type ? 'ring-4 ring-white ring-offset-2 ring-offset-gray-900 scale-105' : ''
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-t border-gray-700">
        <button
          onClick={handleUndo}
          disabled={undoStack.current.length === 0 || undoMutation.isPending}
          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
        >
          ↩ Undo
        </button>
        <button
          onClick={() => setLogOpen((o) => !o)}
          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
        >
          📋 Log ({events.length})
        </button>
      </div>

      {/* Game log drawer */}
      {logOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end" onClick={() => setLogOpen(false)}>
          <div
            className="bg-gray-900 rounded-t-2xl max-h-2/3 overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-300 mb-3">Game Log</div>
            {events.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No events recorded yet</p>
            )}
            {events.slice(-20).reverse().map((e) => (
              <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-gray-800 text-sm">
                <span className="text-gray-500 w-8 text-xs">Q{e.period}</span>
                <span className="font-mono text-brand-400 text-xs">{e.statType}</span>
                <span className="text-gray-400 text-xs">{e.playerId?.slice(0, 8)}…</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
