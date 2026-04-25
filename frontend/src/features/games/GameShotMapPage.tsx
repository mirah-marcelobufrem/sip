import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ShotChart } from '../../components/charts/ShotChart';

type ShotMode = 'dots' | 'heat';

interface RawEvent {
  id: string;
  statType: string;
  playerId: string | null;
  teamId: string | null;
  xCourt: number | null;
  yCourt: number | null;
}

interface BoxRow {
  playerId: string;
  playerName: string | null;
  jerseyNumber: number | null;
  teamId: string | null;
  isHomeTeam: boolean;
}

const SHOT_TYPES = new Set(['2PM', '2PA', '3PM', '3PA']);

export default function GameShotMapPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [selectedPlayer, setSelectedPlayer] = useState('all');
  const [mode, setMode] = useState<ShotMode>('dots');

  const { data: events = [] } = useQuery<RawEvent[]>({
    queryKey: ['game-log', gameId],
    queryFn: () => api.get(`/games/${gameId}/log`),
  });

  const { data: boxRows = [] } = useQuery<BoxRow[]>({
    queryKey: ['box-score', gameId],
    queryFn: () => api.get(`/games/${gameId}/box-score`),
  });

  const playerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of boxRows) {
      const name = row.playerName ?? `#${row.jerseyNumber ?? '?'}`;
      map.set(row.playerId, name);
    }
    return map;
  }, [boxRows]);

  const playerOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: string; label: string }[] = [];
    for (const row of boxRows) {
      if (!seen.has(row.playerId)) {
        seen.add(row.playerId);
        const name = row.playerName ?? `#${row.jerseyNumber ?? '?'}`;
        opts.push({ id: row.playerId, label: `[${row.isHomeTeam ? 'Home' : 'Away'}] ${name}` });
      }
    }
    return opts;
  }, [boxRows]);

  const shotEvents = useMemo(
    () => events.filter((e) => SHOT_TYPES.has(e.statType) && e.xCourt != null && e.yCourt != null),
    [events],
  );

  const missingLocation = useMemo(
    () => events.filter((e) => SHOT_TYPES.has(e.statType) && e.xCourt == null).length,
    [events],
  );

  const filteredShots = useMemo(() => {
    const evts = selectedPlayer === 'all'
      ? shotEvents
      : shotEvents.filter((e) => e.playerId === selectedPlayer);
    return evts.map((e) => ({
      x: e.xCourt!,
      y: e.yCourt!,
      made: e.statType === '2PM' || e.statType === '3PM',
      type: e.statType as '2PM' | '2PA' | '3PM' | '3PA',
    }));
  }, [shotEvents, selectedPlayer]);

  const makes = filteredShots.filter((s) => s.made).length;
  const total = filteredShots.length;
  const fgPct = total > 0 ? ((makes / total) * 100).toFixed(1) : null;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Link to={-1 as never} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">← Back</Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Shot Map</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={selectedPlayer}
          onChange={(e) => setSelectedPlayer(e.target.value)}
          className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
        >
          <option value="all">All Players</option>
          {playerOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>

        <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden shrink-0">
          {(['dots', 'heat'] as ShotMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-2 text-sm font-medium capitalize transition-colors ${
                mode === m
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium text-gray-900 dark:text-gray-100">{total} shots</span>
        <span>{makes} made</span>
        {fgPct && <span className="font-medium">{fgPct}% FG</span>}
        {missingLocation > 0 && (
          <span className="text-amber-600 dark:text-amber-400 text-xs">{missingLocation} without location</span>
        )}
      </div>

      <div className="w-full">
        <ShotChart
          shots={filteredShots}
          width={600}
          height={Math.round(600 * 14 / 15)}
          mode={mode}
        />
      </div>

      {mode === 'dots' && total > 0 && (
        <div className="flex items-center gap-5 mt-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="#16a34a" opacity="0.85" /></svg>
            Made
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14"><circle cx="7" cy="7" r="5" fill="none" stroke="#ef4444" strokeWidth="2" opacity="0.85" /></svg>
            Miss
          </div>
        </div>
      )}

      {total === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-6">
          {selectedPlayer === 'all'
            ? 'No shot location data for this game yet.'
            : `No shot location data for ${playerMap.get(selectedPlayer) ?? 'this player'}.`}
        </p>
      )}
    </div>
  );
}
