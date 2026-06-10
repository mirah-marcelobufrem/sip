import { useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CourtLocationPicker, type ShotStatType } from '../../components/charts/CourtLocationPicker';
import { PossessionIndicator } from './PossessionIndicator';

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
  statType: StatType | 'SUB_IN' | 'SUB_OUT' | 'PERIOD_START' | 'PERIOD_END' | 'TIMEOUT';
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  teamId: string;
  status?: string;
}

interface Game {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  status: string;
  currentPeriod: number;
  numPeriods: number;
  format: string;
  finalScoreHome: number | null;
  finalScoreAway: number | null;
  // Possession tracking (FIBA Sprint A1) — may be absent until the backend lands
  currentPossessionTeamId?: string | null;
  possessionArrowTeamId?: string | null;
}

const STAT_BUTTONS: { type: StatType; label: string; color: string }[] = [
  { type: '2PM', label: '2 Made', color: 'bg-green-500 hover:bg-green-600' },
  { type: '2PA', label: '2 Miss', color: 'bg-red-400 hover:bg-red-500' },
  { type: '3PM', label: '3 Made', color: 'bg-green-600 hover:bg-green-700' },
  { type: '3PA', label: '3 Miss', color: 'bg-red-500 hover:bg-red-600' },
  { type: 'FTM', label: 'FT Made', color: 'bg-blue-500 hover:bg-blue-600' },
  { type: 'FTA', label: 'FT Miss', color: 'bg-blue-400 hover:bg-blue-500' },
  { type: 'OREB', label: 'OReb', color: 'bg-orange-500 hover:bg-orange-600' },
  { type: 'DREB', label: 'DReb', color: 'bg-orange-400 hover:bg-orange-500' },
  { type: 'AST', label: 'Assist', color: 'bg-purple-500 hover:bg-purple-600' },
  { type: 'TO', label: 'T/O', color: 'bg-yellow-600 hover:bg-yellow-700' },
  { type: 'STL', label: 'Steal', color: 'bg-teal-500 hover:bg-teal-600' },
  { type: 'BLK', label: 'Block', color: 'bg-teal-600 hover:bg-teal-700' },
  { type: 'PF', label: 'Foul', color: 'bg-gray-600 hover:bg-gray-700' },
  { type: 'TF', label: 'Tech', color: 'bg-gray-700 hover:bg-gray-800' },
];

const FOUL_BONUS_THRESHOLD = 5;
const SHOT_STATS = new Set<StatType>(['2PM', '2PA', '3PM', '3PA']);

function calcScore(events: StatEvent[], teamId: string | null): number {
  return events.reduce((acc, e) => {
    if (e.teamId !== teamId) return acc;
    if (e.statType === '2PM') return acc + 2;
    if (e.statType === '3PM') return acc + 3;
    if (e.statType === 'FTM') return acc + 1;
    return acc;
  }, 0);
}

function calcFouls(events: StatEvent[], teamId: string | null, period: number): number {
  return events.filter(
    (e) => e.teamId === teamId && e.period === period && e.statType === 'PF',
  ).length;
}

function PlayerButton({
  player, selected, disabled, onClick,
}: {
  player: Player;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center py-2 px-1 rounded-lg text-center transition-all ${
        selected
          ? 'bg-brand-600 ring-2 ring-brand-400 animate-pulse'
          : disabled
          ? 'bg-gray-800 opacity-40 cursor-default'
          : 'bg-gray-800 hover:bg-gray-700'
      }`}
    >
      <span className="text-base font-bold leading-none">#{player.jerseyNumber ?? '?'}</span>
      <span className="text-xs text-gray-300 truncate w-full text-center mt-0.5 leading-tight">
        {player.lastName}
      </span>
    </button>
  );
}

export default function LiveRecordingPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedStat, setSelectedStat] = useState<StatType | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away' | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subTeam, setSubTeam] = useState<'home' | 'away'>('home');
  const [subOut, setSubOut] = useState<string>('');
  const [subIn, setSubIn] = useState<string>('');
  const [showPeriodConfirm, setShowPeriodConfirm] = useState(false);
  const [pendingShot, setPendingShot] = useState<{
    playerId: string;
    teamId: string;
    statType: ShotStatType;
    playerName: string;
  } | null>(null);
  const undoStack = useRef<string[]>([]);

  const { data: game } = useQuery<Game>({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`),
  });

  const { data: homePlayers = [] } = useQuery<Player[]>({
    queryKey: ['players', game?.homeTeamId],
    queryFn: () => api.get(`/teams/${game!.homeTeamId}/players`),
    enabled: !!game?.homeTeamId,
  });

  const { data: awayPlayers = [] } = useQuery<Player[]>({
    queryKey: ['players', game?.awayTeamId],
    queryFn: () => api.get(`/teams/${game!.awayTeamId}/players`),
    enabled: !!game?.awayTeamId,
  });

  const { data: events = [] } = useQuery<StatEvent[]>({
    queryKey: ['game-log', gameId],
    queryFn: () => api.get(`/games/${gameId}/log`),
    refetchInterval: 4000,
  });

  const period = game?.currentPeriod ?? 1;
  const periodLabel = game?.format === 'halves' ? `H${period}` : `Q${period}`;

  const homeScore = useMemo(() => calcScore(events, game?.homeTeamId ?? null), [events, game]);
  const awayScore = useMemo(() => calcScore(events, game?.awayTeamId ?? null), [events, game]);
  const homeFouls = useMemo(() => calcFouls(events, game?.homeTeamId ?? null, period), [events, game, period]);
  const awayFouls = useMemo(() => calcFouls(events, game?.awayTeamId ?? null, period), [events, game, period]);

  const activeHome = homePlayers.filter((p) => !p.status || p.status === 'active');
  const activeAway = awayPlayers.filter((p) => !p.status || p.status === 'active');

  const startMutation = useMutation({
    mutationFn: () => api.post(`/games/${gameId}/start`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['game', gameId] }),
  });

  const recordMutation = useMutation({
    mutationFn: (payload: { playerId: string; teamId: string; statType: StatType; xCourt?: number; yCourt?: number }) =>
      api.post<StatEvent>(`/games/${gameId}/events`, {
        period,
        statType: payload.statType,
        playerId: payload.playerId,
        teamId: payload.teamId,
        xCourt: payload.xCourt,
        yCourt: payload.yCourt,
      }),
    onSuccess: (event) => {
      undoStack.current = [event.id, ...undoStack.current.slice(0, 19)];
      setSelectedStat(null);
      setSelectedTeam(null);
      setPendingShot(null);
      queryClient.invalidateQueries({ queryKey: ['game-log', gameId] });
      // Possession fields live on the game row — refresh after each event
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  const undoMutation = useMutation({
    mutationFn: (eventId: string) => api.delete(`/games/${gameId}/events/${eventId}`),
    onSuccess: () => {
      undoStack.current = undoStack.current.slice(1);
      queryClient.invalidateQueries({ queryKey: ['game-log', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
    },
  });

  const subMutation = useMutation({
    mutationFn: (payload: { playerInId: string; playerOutId: string; teamId: string }) =>
      api.post(`/games/${gameId}/lineups`, { ...payload, period }),
    onSuccess: () => {
      setShowSubModal(false);
      setSubOut('');
      setSubIn('');
      queryClient.invalidateQueries({ queryKey: ['game-log', gameId] });
    },
  });

  const advancePeriodMutation = useMutation({
    mutationFn: async () => {
      // Post PERIOD_END event before advancing the period counter
      await api.post(`/games/${gameId}/events`, {
        period,
        statType: 'PERIOD_END',
        playerId: null,
        teamId: null,
      });
      await api.patch(`/games/${gameId}`, { currentPeriod: period + 1 });
    },
    onSuccess: () => {
      setShowPeriodConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game-log', gameId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      api.post(`/games/${gameId}/complete`, { finalScoreHome: homeScore, finalScoreAway: awayScore }),
    onSuccess: () => navigate(-1),
  });

  const handleStatSelect = useCallback((stat: StatType) => {
    setSelectedStat((prev) => (prev === stat ? null : stat));
    setSelectedTeam(null);
  }, []);

  const handlePlayerTap = useCallback(
    (player: Player, side: 'home' | 'away') => {
      if (!selectedStat) return;
      const teamId = side === 'home' ? game?.homeTeamId : game?.awayTeamId;
      if (!teamId) return;

      if (SHOT_STATS.has(selectedStat as ShotStatType)) {
        setPendingShot({
          playerId: player.id,
          teamId,
          statType: selectedStat as ShotStatType,
          playerName: `#${player.jerseyNumber ?? '?'} ${player.lastName}`,
        });
        return;
      }

      recordMutation.mutate({ playerId: player.id, teamId, statType: selectedStat });
    },
    [selectedStat, game, recordMutation],
  );

  const handleUndo = useCallback(() => {
    const lastId = undoStack.current[0];
    if (lastId) undoMutation.mutate(lastId);
  }, [undoMutation]);

  const subTeamPlayers = subTeam === 'home' ? activeHome : activeAway;
  const subTeamId = subTeam === 'home' ? game?.homeTeamId : game?.awayTeamId;

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
    <div className="h-screen flex flex-col bg-gray-900 text-white select-none overflow-hidden">
      {/* Score bar */}
      <div className="flex items-center px-3 py-2 bg-gray-800 border-b border-gray-700 gap-2 shrink-0">
        {/* Home */}
        <div className="flex-1 text-center">
          <div className="text-3xl font-bold tabular-nums">{homeScore}</div>
          <div className="text-xs text-gray-400">HOME</div>
          <div className={`text-xs font-semibold mt-0.5 ${homeFouls >= FOUL_BONUS_THRESHOLD ? 'text-red-400' : 'text-gray-500'}`}>
            {homeFouls >= FOUL_BONUS_THRESHOLD
              ? <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-xs font-bold">BONUS</span>
              : `${homeFouls} fouls`}
          </div>
        </div>

        {/* Period + controls */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setShowPeriodConfirm(true)}
            className="text-lg font-bold text-white bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg tabular-nums"
            title="Advance period"
          >
            {periodLabel}
          </button>
          <div className="flex gap-1">
            <button
              onClick={() => { setSubTeam('home'); setShowSubModal(true); }}
              className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Sub
            </button>
            <button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              className="text-xs px-2 py-0.5 bg-red-700 hover:bg-red-600 rounded"
            >
              End
            </button>
          </div>
        </div>

        {/* Away */}
        <div className="flex-1 text-center">
          <div className="text-3xl font-bold tabular-nums">{awayScore}</div>
          <div className="text-xs text-gray-400">AWAY</div>
          <div className={`text-xs font-semibold mt-0.5 ${awayFouls >= FOUL_BONUS_THRESHOLD ? 'text-red-400' : 'text-gray-500'}`}>
            {awayFouls >= FOUL_BONUS_THRESHOLD
              ? <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-xs font-bold">BONUS</span>
              : `${awayFouls} fouls`}
          </div>
        </div>
      </div>

      {/* Possession arrow indicator (data from the existing live game query) */}
      <PossessionIndicator
        currentPossessionTeamId={game?.currentPossessionTeamId}
        possessionArrowTeamId={game?.possessionArrowTeamId}
        homeTeamId={game?.homeTeamId ?? null}
        awayTeamId={game?.awayTeamId ?? null}
      />

      {/* Stat prompt banner */}
      {selectedStat && (
        <div className="bg-brand-700 text-center py-1.5 text-sm font-semibold shrink-0">
          {selectedStat} — tap a player
        </div>
      )}

      {/* Lineups: Home | Away */}
      <div className="shrink-0 border-b border-gray-700 bg-gray-850">
        <div className="grid grid-cols-2 divide-x divide-gray-700">
          {/* Home lineup */}
          <div className="p-1.5">
            <p className="text-xs text-gray-500 text-center mb-1 font-medium">HOME</p>
            <div className="grid grid-cols-5 gap-1">
              {activeHome.slice(0, 10).map((p) => (
                <PlayerButton
                  key={p.id}
                  player={p}
                  selected={false}
                  disabled={!selectedStat}
                  onClick={() => handlePlayerTap(p, 'home')}
                />
              ))}
              {activeHome.length === 0 && (
                <div className="col-span-5 text-center text-gray-600 py-2 text-xs">No players</div>
              )}
            </div>
          </div>

          {/* Away lineup */}
          <div className="p-1.5">
            <p className="text-xs text-gray-500 text-center mb-1 font-medium">AWAY</p>
            <div className="grid grid-cols-5 gap-1">
              {activeAway.slice(0, 10).map((p) => (
                <PlayerButton
                  key={p.id}
                  player={p}
                  selected={false}
                  disabled={!selectedStat}
                  onClick={() => handlePlayerTap(p, 'away')}
                />
              ))}
              {activeAway.length === 0 && (
                <div className="col-span-5 text-center text-gray-600 py-2 text-xs">No players</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stat buttons grid */}
      <div className="flex-1 p-2 grid grid-cols-4 gap-1.5 content-start overflow-auto">
        {STAT_BUTTONS.map((btn) => (
          <button
            key={btn.type}
            onClick={() => handleStatSelect(btn.type)}
            className={`py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95 ${btn.color} ${
              selectedStat === btn.type ? 'ring-4 ring-white ring-offset-2 ring-offset-gray-900 scale-105' : ''
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-t border-gray-700 shrink-0">
        <button
          onClick={handleUndo}
          disabled={undoStack.current.length === 0 || undoMutation.isPending}
          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded-lg text-sm font-medium"
        >
          ↩ Undo
        </button>
        <button
          onClick={() => setLogOpen((o) => !o)}
          className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
        >
          Log ({events.length})
        </button>
      </div>

      {/* Game log drawer */}
      {logOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end" onClick={() => setLogOpen(false)}>
          <div
            className="bg-gray-900 rounded-t-2xl max-h-[60vh] overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold text-gray-300 mb-3">Game Log</div>
            {events.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">No events yet</p>
            )}
            {[...events].reverse().slice(0, 30).map((e) => {
              const allPlayers = [...homePlayers, ...awayPlayers];
              const player = allPlayers.find((p) => p.id === e.playerId);
              const name = player ? `#${player.jerseyNumber ?? '?'} ${player.lastName}` : '—';
              return (
                <div key={e.id} className="flex items-center gap-3 py-1.5 border-b border-gray-800 text-sm">
                  <span className="text-gray-500 w-8 text-xs font-mono">{game?.format === 'halves' ? `H${e.period}` : `Q${e.period}`}</span>
                  <span className="font-mono font-semibold text-brand-400 text-xs w-12">{e.statType}</span>
                  <span className="text-gray-400 text-xs flex-1 truncate">{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Substitution modal */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-5 w-full max-w-sm">
            <h3 className="text-base font-semibold text-white mb-4">Substitution</h3>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSubTeam('home')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${subTeam === 'home' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400'}`}
              >
                Home
              </button>
              <button
                onClick={() => setSubTeam('away')}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${subTeam === 'away' ? 'bg-brand-600 text-white' : 'bg-gray-800 text-gray-400'}`}
              >
                Away
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Player OUT</label>
                <select
                  value={subOut}
                  onChange={(e) => setSubOut(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none"
                >
                  <option value="">— select —</option>
                  {subTeamPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.jerseyNumber ?? '?'} {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Player IN</label>
                <select
                  value={subIn}
                  onChange={(e) => setSubIn(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none"
                >
                  <option value="">— select —</option>
                  {subTeamPlayers.filter((p) => p.id !== subOut).map((p) => (
                    <option key={p.id} value={p.id}>
                      #{p.jerseyNumber ?? '?'} {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSubModal(false); setSubOut(''); setSubIn(''); }}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (subOut && subIn && subTeamId) {
                    subMutation.mutate({ playerInId: subIn, playerOutId: subOut, teamId: subTeamId });
                  }
                }}
                disabled={!subOut || !subIn || subMutation.isPending}
                className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-lg text-sm font-semibold text-white"
              >
                {subMutation.isPending ? 'Saving…' : 'Confirm Sub'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Court location picker for shot events */}
      {pendingShot && (
        <CourtLocationPicker
          statType={pendingShot.statType}
          playerName={pendingShot.playerName}
          onConfirm={(x, y, statType) => {
            // statType is auto-derived from the tapped location (2pt vs 3pt),
            // preserving made/missed from the original stat button.
            recordMutation.mutate({
              playerId: pendingShot.playerId,
              teamId: pendingShot.teamId,
              statType,
              xCourt: x,
              yCourt: y,
            });
          }}
          onSkip={() => {
            recordMutation.mutate({
              playerId: pendingShot.playerId,
              teamId: pendingShot.teamId,
              statType: pendingShot.statType,
            });
          }}
          onCancel={() => setPendingShot(null)}
        />
      )}

      {/* Period advance confirmation */}
      {showPeriodConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-5 w-full max-w-xs text-center">
            <p className="text-white font-semibold text-lg mb-1">
              End of {periodLabel}
            </p>
            <div className="flex items-center justify-center gap-4 my-3">
              <div className="text-center">
                <div className="text-3xl font-bold tabular-nums text-white">{homeScore}</div>
                <div className="text-xs text-gray-500 mt-0.5">HOME</div>
              </div>
              <div className="text-gray-600 font-bold text-xl">|</div>
              <div className="text-center">
                <div className="text-3xl font-bold tabular-nums text-white">{awayScore}</div>
                <div className="text-xs text-gray-500 mt-0.5">AWAY</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Confirm to advance to {game?.format === 'halves' ? `H${period + 1}` : `Q${period + 1}`}.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPeriodConfirm(false)}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => advancePeriodMutation.mutate()}
                disabled={advancePeriodMutation.isPending}
                className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-lg text-sm font-semibold text-white"
              >
                {advancePeriodMutation.isPending ? '…' : 'Confirm & Advance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
