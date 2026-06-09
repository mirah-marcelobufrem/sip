import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface PlayerInfo {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string | null;
}

interface SeasonStatRow {
  player: { id: string; firstName: string; lastName: string; jerseyNumber: number | null; position: string | null };
  box: Record<string, number>;
  derived: Record<string, number | null>;
  gamesPlayed: number;
}

interface ComparisonStat {
  label: string;
  key: string;
  format: (v: number | null) => string;
  getValue: (row: SeasonStatRow) => number | null;
}

const COMPARISON_STATS: ComparisonStat[] = [
  {
    label: 'GP',
    key: 'gp',
    format: (v) => v?.toFixed(0) ?? '—',
    getValue: (r) => r.gamesPlayed,
  },
  {
    label: 'PPG',
    key: 'ppg',
    format: (v) => v?.toFixed(1) ?? '—',
    getValue: (r) => r.gamesPlayed > 0 ? (r.box.pts ?? 0) / r.gamesPlayed : null,
  },
  {
    label: 'RPG',
    key: 'rpg',
    format: (v) => v?.toFixed(1) ?? '—',
    getValue: (r) => r.gamesPlayed > 0 ? (r.box.reb ?? 0) / r.gamesPlayed : null,
  },
  {
    label: 'APG',
    key: 'apg',
    format: (v) => v?.toFixed(1) ?? '—',
    getValue: (r) => r.gamesPlayed > 0 ? (r.box.ast ?? 0) / r.gamesPlayed : null,
  },
  {
    label: 'SPG',
    key: 'spg',
    format: (v) => v?.toFixed(1) ?? '—',
    getValue: (r) => r.gamesPlayed > 0 ? (r.box.stl ?? 0) / r.gamesPlayed : null,
  },
  {
    label: 'BPG',
    key: 'bpg',
    format: (v) => v?.toFixed(1) ?? '—',
    getValue: (r) => r.gamesPlayed > 0 ? (r.box.blk ?? 0) / r.gamesPlayed : null,
  },
  {
    label: 'FG%',
    key: 'fgPct',
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—',
    getValue: (r) => r.derived?.fgPct ?? null,
  },
  {
    label: 'eFG%',
    key: 'efgPct',
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—',
    getValue: (r) => r.derived?.efgPct ?? null,
  },
  {
    label: '3P%',
    key: 'threePct',
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—',
    getValue: (r) => r.derived?.threePct ?? null,
  },
  {
    label: 'TS%',
    key: 'tsPct',
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—',
    getValue: (r) => r.derived?.tsPct ?? null,
  },
  {
    label: 'MIN/G',
    key: 'minPg',
    format: (v) => v?.toFixed(1) ?? '—',
    getValue: (r) => r.gamesPlayed > 0 && r.box.minutes != null ? r.box.minutes / r.gamesPlayed : null,
  },
];

const MAX_PLAYERS = 4;

export default function PlayerComparisonPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { data: players = [] } = useQuery<PlayerInfo[]>({
    queryKey: ['players', teamId],
    queryFn: () => api.get(`/teams/${teamId}/players`),
  });

  const { data: seasonStats = [] } = useQuery<SeasonStatRow[]>({
    queryKey: ['player-season-stats', teamId],
    queryFn: () => api.get(`/teams/${teamId}/players/season-stats`),
  });

  const selectedStats = useMemo(
    () => seasonStats.filter((r) => selectedIds.includes(r.player.id)),
    [seasonStats, selectedIds],
  );

  const bestValues = useMemo(() => {
    const result: Record<string, number | null> = {};
    for (const stat of COMPARISON_STATS) {
      const vals = selectedStats.map((r) => stat.getValue(r)).filter((v): v is number => v != null);
      result[stat.key] = vals.length > 0 ? Math.max(...vals) : null;
    }
    return result;
  }, [selectedStats]);

  const availablePlayers = players.filter((p) => !selectedIds.includes(p.id));

  function addPlayer(id: string) {
    if (selectedIds.length >= MAX_PLAYERS) return;
    setSelectedIds((prev) => [...prev, id]);
    setDropdownOpen(false);
  }

  function removePlayer(id: string) {
    setSelectedIds((prev) => prev.filter((pid) => pid !== id));
  }

  function getPlayerLabel(p: PlayerInfo) {
    return `${p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ''}${p.firstName} ${p.lastName}`;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/teams/${teamId}/players`} className="text-gray-400 hover:text-gray-600 text-sm">← Roster</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Player Comparison</h1>
      </div>

      {/* Player selector bar */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.map((id) => {
            const p = players.find((pl) => pl.id === id);
            if (!p) return null;
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-full text-sm text-brand-700 dark:text-brand-300"
              >
                <span>{getPlayerLabel(p)}</span>
                <button
                  onClick={() => removePlayer(id)}
                  className="text-brand-400 hover:text-brand-700 dark:hover:text-brand-200 leading-none"
                  aria-label={`Remove ${p.firstName}`}
                >
                  ×
                </button>
              </div>
            );
          })}

          {selectedIds.length < MAX_PLAYERS && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-300 dark:border-gray-600 rounded-full text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                + Add Player
              </button>
              {dropdownOpen && availablePlayers.length > 0 && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg min-w-[200px] max-h-60 overflow-y-auto">
                  {availablePlayers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addPlayer(p.id)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 first:rounded-t-xl last:rounded-b-xl"
                    >
                      {getPlayerLabel(p)}
                      {p.position && <span className="ml-1 text-gray-400 text-xs">· {p.position}</span>}
                    </button>
                  ))}
                  {availablePlayers.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-400">All players selected</p>
                  )}
                </div>
              )}
            </div>
          )}

          {selectedIds.length === 0 && (
            <p className="text-sm text-gray-400 ml-1">Select up to {MAX_PLAYERS} players to compare</p>
          )}
        </div>
      </div>

      {/* Comparison table */}
      {selectedStats.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-card">
          <table className="w-full text-sm bg-white dark:bg-gray-900">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase min-w-[120px]">Stat</th>
                {selectedStats.map((r) => (
                  <th key={r.player.id} className="px-4 py-3 text-xs font-medium text-gray-700 dark:text-gray-300 uppercase text-center whitespace-nowrap">
                    <div>{r.player.firstName} {r.player.lastName}</div>
                    {r.player.jerseyNumber != null && (
                      <div className="text-gray-400 font-mono font-normal">#{r.player.jerseyNumber}</div>
                    )}
                    {r.player.position && (
                      <div className="text-gray-400 font-normal normal-case">{r.player.position}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {COMPARISON_STATS.map((stat) => (
                <tr key={stat.key} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">{stat.label}</td>
                  {selectedStats.map((r) => {
                    const val = stat.getValue(r);
                    const isBest = val != null && bestValues[stat.key] != null && val === bestValues[stat.key] && selectedStats.length > 1;
                    return (
                      <td
                        key={r.player.id}
                        className={`px-4 py-2.5 text-center font-semibold ${
                          isBest
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {stat.format(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.length > 0 && selectedStats.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center shadow-card">
          <p className="text-gray-400 text-sm">No season stats available for the selected players.</p>
        </div>
      )}
    </div>
  );
}
