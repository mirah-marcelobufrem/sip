import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GameFlowChart } from '../../components/charts/GameFlowChart';

interface SeasonStats {
  wins: number;
  losses: number;
  gamesPlayed: number;
  pointsPerGame: number;
  pointsAllowedPerGame: number;
  teamFgPct: number | null;
}

interface PlayerSeasonRow {
  player: { id: string; firstName: string; lastName: string; jerseyNumber: number | null };
  box: { pts: number; reb: number; ast: number; to: number; fgm: number; fga: number } | null;
  derived: { fgPct: number | null; ptsPerGame: number; rebPerGame: number; astPerGame: number } | null;
  gamesPlayed: number;
}

interface Efficiency {
  ortg: number | null;
  drtg: number | null;
  nrtg: number | null;
  pace: number | null;
  gamesPlayed: number;
}

interface Game {
  id: string;
  date: string;
  finalScoreHome: number | null;
  finalScoreAway: number | null;
  homeTeamId: string | null;
  status: string;
}

interface LineupStat {
  playerIds: string[];
  pts: number;
  plusMinus: number;
  ortg: number | null;
}

interface FlowData {
  flowPoints: { period: number; clockTimeSeconds: number | null; homeScore: number; awayScore: number; differential: number }[];
  scoringRuns: { teamId: string; points: number; startPeriod: number; endPeriod: number }[];
}

export default function AnalyticsDashboard() {
  const { teamId } = useParams<{ teamId: string }>();
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'season' | 'lineup' | 'flow'>('season');

  const { data: season } = useQuery<SeasonStats>({
    queryKey: ['season-stats', teamId],
    queryFn: () => api.get(`/teams/${teamId}/season-stats`),
  });

  const { data: playerStats = [] } = useQuery<PlayerSeasonRow[]>({
    queryKey: ['player-season-stats', teamId],
    queryFn: () => api.get(`/teams/${teamId}/players/season-stats`),
  });

  const { data: efficiency } = useQuery<Efficiency>({
    queryKey: ['team-efficiency', teamId],
    queryFn: () => api.get(`/teams/${teamId}/efficiency`),
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ['games', teamId],
    queryFn: () => api.get(`/teams/${teamId}/games`),
  });

  const { data: lineupStats = [] } = useQuery<LineupStat[]>({
    queryKey: ['lineup-stats', teamId],
    queryFn: () => api.get(`/teams/${teamId}/lineup-stats`),
    enabled: activeTab === 'lineup',
  });

  const { data: flowData } = useQuery<FlowData>({
    queryKey: ['game-flow', selectedGameId],
    queryFn: () => api.get(`/games/${selectedGameId}/flow`),
    enabled: activeTab === 'flow' && !!selectedGameId,
  });

  const completedGames = games.filter((g) => g.status === 'completed');

  const trendData = completedGames
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((g, i) => ({
      game: `G${i + 1}`,
      pts: g.homeTeamId === teamId ? g.finalScoreHome : g.finalScoreAway,
    }));

  const leaders = [...playerStats]
    .filter((r) => r.box !== null)
    .sort((a, b) => (b.derived?.ptsPerGame ?? 0) - (a.derived?.ptsPerGame ?? 0))
    .slice(0, 8);

  const playerNameMap = new Map(
    playerStats.map((r) => [r.player.id, `${r.player.firstName} ${r.player.lastName}`])
  );

  const tabs = [
    { id: 'season' as const, label: 'Season' },
    { id: 'lineup' as const, label: 'Lineups' },
    { id: 'flow' as const, label: 'Game Flow' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analytics</h1>

      {/* Summary cards — always visible */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Record', value: season ? `${season.wins}–${season.losses}` : '—' },
          { label: 'PPG', value: season?.pointsPerGame?.toFixed(1) ?? '—' },
          { label: 'OPP PPG', value: season?.pointsAllowedPerGame?.toFixed(1) ?? '—' },
          { label: 'Games', value: season?.gamesPlayed?.toString() ?? '—' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Season tab */}
      {activeTab === 'season' && (
        <>
          {efficiency && efficiency.gamesPlayed > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'ORTG', value: efficiency.ortg?.toFixed(1) ?? '—', tip: 'Off. Rating per 100 poss.' },
                { label: 'DRTG', value: efficiency.drtg?.toFixed(1) ?? '—', tip: 'Def. Rating per 100 poss.' },
                { label: 'Net RTG', value: efficiency.nrtg !== null ? (efficiency.nrtg > 0 ? `+${efficiency.nrtg.toFixed(1)}` : efficiency.nrtg.toFixed(1)) : '—', tip: 'Net Rating' },
                { label: 'Pace', value: efficiency.pace?.toFixed(1) ?? '—', tip: 'Possessions per 40 min' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card text-center" title={stat.tip}>
                  <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {trendData.length > 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Points Per Game — Season Trend</h2>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="game" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="pts" stroke="#1a56db" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card text-center py-8">
              <p className="text-gray-400 text-sm">Complete some games to see trend data</p>
            </div>
          )}

          {leaders.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Season Leaders</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Player</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">GP</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">PPG</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">RPG</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">APG</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">FG%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {leaders.map((row) => (
                    <tr key={row.player.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                        {row.player.jerseyNumber !== null && (
                          <span className="text-gray-400 font-mono text-xs mr-2">#{row.player.jerseyNumber}</span>
                        )}
                        {row.player.firstName} {row.player.lastName}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{row.gamesPlayed}</td>
                      <td className="px-3 py-2.5 text-center font-semibold text-gray-900 dark:text-gray-100">
                        {row.derived?.ptsPerGame.toFixed(1) ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{row.derived?.rebPerGame.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">{row.derived?.astPerGame.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500">
                        {row.derived?.fgPct !== null && row.derived?.fgPct !== undefined
                          ? `${(row.derived.fgPct * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Lineup analysis tab */}
      {activeTab === 'lineup' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top Lineups</h2>
            <p className="text-xs text-gray-400 mt-0.5">5-player combinations with at least 5 tracked events</p>
          </div>
          {lineupStats.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">No lineup data yet. Record substitutions during live games to track lineup splits.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Lineup</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">PTS</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">+/-</th>
                    <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">ORTG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {lineupStats.map((ls, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">
                        {ls.playerIds
                          .map((id) => playerNameMap.get(id) ?? id.slice(0, 8))
                          .join(' · ')}
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-gray-900 dark:text-gray-100">{ls.pts}</td>
                      <td className={`px-3 py-2.5 text-center font-medium ${ls.plusMinus > 0 ? 'text-green-600' : ls.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                        {ls.plusMinus > 0 ? `+${ls.plusMinus}` : ls.plusMinus}
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-500">
                        {ls.ortg !== null ? ls.ortg.toFixed(1) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Game flow tab */}
      {activeTab === 'flow' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Select game</label>
            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— choose a game —</option>
              {completedGames
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {new Date(g.date).toLocaleDateString()}
                    {g.finalScoreHome !== null ? ` · ${g.finalScoreHome}–${g.finalScoreAway}` : ''}
                  </option>
                ))}
            </select>
          </div>

          {!selectedGameId && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center shadow-card">
              <p className="text-gray-400 text-sm">Select a completed game to view its score flow chart</p>
            </div>
          )}

          {selectedGameId && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Score Differential</h2>
              <GameFlowChart
                flowPoints={flowData?.flowPoints ?? []}
                scoringRuns={flowData?.scoringRuns ?? []}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
