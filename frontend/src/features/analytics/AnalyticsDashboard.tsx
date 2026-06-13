import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
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

interface FourFactors {
  efgPct: number | null;
  tovPct: number | null;
  orebPct: number | null;
  ftRate: number | null;
}

interface Efficiency {
  ortg: number | null;
  drtg: number | null;
  nrtg: number | null;
  pace: number | null;
  gamesPlayed: number;
  fourFactors?: FourFactors | null;
  fourFactorsOpp?: FourFactors | null;
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
  scoringRuns: { teamId: string; points: number; period: number; startClock: number | null; endClock: number | null }[];
}

interface TrendData {
  statKey: string;
  games: { gameId: string; gameDate: string; opponentLabel: string; value: number }[];
}

interface MatchupData {
  record: { wins: number; losses: number };
  avgScoreDiff: number;
  avgPts: number;
  avgOppPts: number;
  games: { gameId: string; date: string; opponentLabel: string; teamScore: number; oppScore: number; result: 'W' | 'L' }[];
}

interface ComboStat {
  playerIds: string[];
  eventsTogether: number;
  pts: number;
  ptsPer50: number;
}

function AiInsightsTab({ teamId }: { teamId: string }) {
  const [opponent, setOpponent] = useState('');
  const [situation, setSituation] = useState('');
  const [recommendation, setRecommendation] = useState<string | null>(null);

  const lineupMutation = useMutation({
    mutationFn: () =>
      api.post<{ recommendation: string }>(`/ai/lineup-recommendation/${teamId}`, {
        opponent: opponent || undefined,
        situation: situation || undefined,
      }),
    onSuccess: (data) => setRecommendation(data.recommendation),
  });

  const handleRegenerate = () => {
    setRecommendation(null);
    lineupMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Lineup Recommendation */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Lineup Recommendation</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Opponent (optional)</label>
            <input
              type="text"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="e.g. Lakers, Team A…"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Situation (optional)</label>
            <input
              type="text"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="e.g. playoff game, overtime, must-win…"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => lineupMutation.mutate()}
              disabled={lineupMutation.isPending}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {lineupMutation.isPending ? 'Analyzing games…' : 'Get Lineup Recommendations'}
            </button>
            {recommendation && (
              <button
                onClick={handleRegenerate}
                disabled={lineupMutation.isPending}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
              >
                Regenerate
              </button>
            )}
          </div>
        </div>

        {lineupMutation.isPending && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <svg className="animate-spin h-4 w-4 text-brand-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Analyzing games…
          </div>
        )}

        {recommendation && (
          <div className="mt-4 bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-lg p-4">
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-2">
              AI Recommendation
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {recommendation}
            </p>
          </div>
        )}

        {lineupMutation.isError && (
          <p className="mt-3 text-sm text-red-500">Failed to get recommendations. Please try again.</p>
        )}
      </div>

      {/* Development Notes — placeholder */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-5">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Development Notes</h2>
        <p className="text-sm text-gray-400">
          AI-powered development insights for individual players are available on each player's card page.
        </p>
      </div>
    </div>
  );
}

// N-03 — Four Factors card: own team vs opponents, better side highlighted.
// TOV% is the only factor where LOWER is better.
function FourFactorsCard({ own, opp }: { own: FourFactors; opp: FourFactors | null }) {
  const fmtPct = (v: number | null) => (v !== null ? `${(v * 100).toFixed(1)}%` : '—');
  const fmtRate = (v: number | null) => (v !== null ? v.toFixed(2) : '—');

  const columns: {
    key: keyof FourFactors;
    label: string;
    tip: string;
    fmt: (v: number | null) => string;
    lowerIsBetter: boolean;
  }[] = [
    { key: 'efgPct', label: 'eFG%', tip: 'Effective FG% — (FGM + 0.5·3PM) / FGA', fmt: fmtPct, lowerIsBetter: false },
    { key: 'tovPct', label: 'TOV%', tip: 'Turnover rate — TO / (FGA + 0.44·FTA + TO)', fmt: fmtPct, lowerIsBetter: true },
    { key: 'orebPct', label: 'ORB%', tip: 'Offensive rebound share — ORB / (ORB + opp DRB)', fmt: fmtPct, lowerIsBetter: false },
    { key: 'ftRate', label: 'FT Rate', tip: 'Free throw rate — FTA / FGA', fmt: fmtRate, lowerIsBetter: false },
  ];

  const isBetter = (key: keyof FourFactors, lowerIsBetter: boolean, mine: number | null, theirs: number | null | undefined) => {
    if (mine === null || theirs == null) return false;
    return lowerIsBetter ? mine < theirs : mine > theirs;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card" data-testid="four-factors-card">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Four Factors</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-1.5 pr-2 font-medium"></th>
            {columns.map((c) => (
              <th key={c.key} className="py-1.5 px-2 font-medium text-right" title={c.tip}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <td className="py-2 pr-2 font-medium text-gray-900 dark:text-gray-100">Team</td>
            {columns.map((c) => (
              <td
                key={c.key}
                className={`py-2 px-2 text-right tabular-nums ${
                  isBetter(c.key, c.lowerIsBetter, own[c.key], opp?.[c.key])
                    ? 'text-green-600 dark:text-green-400 font-semibold'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {c.fmt(own[c.key])}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-2 pr-2 font-medium text-gray-500">Opponents</td>
            {columns.map((c) => (
              <td
                key={c.key}
                className={`py-2 px-2 text-right tabular-nums ${
                  opp && isBetter(c.key, c.lowerIsBetter, opp[c.key], own[c.key])
                    ? 'text-green-600 dark:text-green-400 font-semibold'
                    : 'text-gray-500'
                }`}
              >
                {opp ? c.fmt(opp[c.key]) : '—'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { teamId } = useParams<{ teamId: string }>();
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'season' | 'lineup' | 'flow' | 'ai'>('season');
  const [trendStat, setTrendStat] = useState<string>('pts');
  const [matchupOpponent, setMatchupOpponent] = useState('');
  const [debouncedOpponent, setDebouncedOpponent] = useState('');
  const [comboSize, setComboSize] = useState<'2' | '3'>('2');

  // Debounce opponent filter by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOpponent(matchupOpponent);
    }, 300);
    return () => clearTimeout(timer);
  }, [matchupOpponent]);

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

  const { data: trendData } = useQuery<TrendData>({
    queryKey: ['trend-stats', teamId, trendStat],
    queryFn: () => api.get(`/teams/${teamId}/trend-stats?stat=${trendStat}`),
    enabled: activeTab === 'season',
  });

  const { data: matchups } = useQuery<MatchupData>({
    queryKey: ['matchups', teamId, debouncedOpponent],
    queryFn: () =>
      api.get(
        `/teams/${teamId}/matchups${debouncedOpponent ? `?opponentName=${encodeURIComponent(debouncedOpponent)}` : ''}`
      ),
    enabled: activeTab === 'season',
  });

  const { data: lineupStats = [] } = useQuery<LineupStat[]>({
    queryKey: ['lineup-stats', teamId],
    queryFn: () => api.get(`/teams/${teamId}/lineup-stats`),
    enabled: activeTab === 'lineup',
  });

  const { data: comboStats = [] } = useQuery<ComboStat[]>({
    queryKey: ['combo-stats', teamId, comboSize],
    queryFn: () => api.get(`/teams/${teamId}/combo-stats?size=${comboSize}`),
    enabled: activeTab === 'lineup',
  });

  const { data: flowData } = useQuery<FlowData>({
    queryKey: ['game-flow', selectedGameId],
    queryFn: () => api.get(`/games/${selectedGameId}/flow`),
    enabled: activeTab === 'flow' && !!selectedGameId,
  });

  const completedGames = games.filter((g) => g.status === 'completed');

  const trendChartData =
    trendData && trendData.games.length > 0
      ? trendData.games.map((g) => ({
          game: g.opponentLabel || new Date(g.gameDate).toLocaleDateString(),
          value: g.value,
        }))
      : null;

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
    { id: 'ai' as const, label: 'AI Insights' },
  ];

  const trendStatOptions = [
    { value: 'pts', label: 'PTS' },
    { value: 'reb', label: 'REB' },
    { value: 'ast', label: 'AST' },
    { value: 'stl', label: 'STL' },
    { value: 'blk', label: 'BLK' },
    { value: 'to', label: 'TO' },
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
          <div className="flex justify-end">
            <Link
              to={`/teams/${teamId}/season-box-score`}
              className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium"
            >
              Season Box Score →
            </Link>
          </div>

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

          {/* N-03 — Four Factors (Dean Oliver) */}
          {efficiency && efficiency.gamesPlayed > 0 && efficiency.fourFactors && (
            <FourFactorsCard own={efficiency.fourFactors} opp={efficiency.fourFactorsOpp ?? null} />
          )}

          {/* Trend chart with stat selector */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Season Trend</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Stat:</label>
                <select
                  value={trendStat}
                  onChange={(e) => setTrendStat(e.target.value)}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-xs bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {trendStatOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {trendChartData ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="game" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#1a56db" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <p className="text-gray-400 text-sm">Complete some games to see trend data</p>
              </div>
            )}
          </div>

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

          {/* Matchup History section */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card">
            <details>
              <summary className="px-4 py-3 cursor-pointer font-semibold text-sm text-gray-700 dark:text-gray-300 select-none">
                Matchup History
              </summary>
              <div className="px-4 pb-4">
                {/* Opponent name filter */}
                <input
                  type="text"
                  placeholder="Filter by opponent name..."
                  value={matchupOpponent}
                  onChange={(e) => setMatchupOpponent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {/* Summary row */}
                {matchups && (
                  <div className="flex gap-6 mb-3 text-sm">
                    <span>
                      <span className="font-bold text-green-600">{matchups.record.wins}W</span>
                      {' – '}
                      <span className="font-bold text-red-500">{matchups.record.losses}L</span>
                    </span>
                    <span className="text-gray-500">
                      Avg diff:{' '}
                      <span className={matchups.avgScoreDiff >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                        {matchups.avgScoreDiff >= 0 ? '+' : ''}{matchups.avgScoreDiff.toFixed(1)}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      Avg:{' '}
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {matchups.avgPts.toFixed(1)} – {matchups.avgOppPts.toFixed(1)}
                      </span>
                    </span>
                  </div>
                )}
                {/* Games list */}
                {matchups?.games.map((g) => (
                  <div
                    key={g.gameId}
                    className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0 text-sm"
                  >
                    <span className="text-gray-500 text-xs">{new Date(g.date).toLocaleDateString()}</span>
                    <span className="text-gray-700 dark:text-gray-300">{g.opponentLabel || '—'}</span>
                    <span className="tabular-nums font-medium">{g.teamScore} – {g.oppScore}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        g.result === 'W'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-600'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-500'
                      }`}
                    >
                      {g.result}
                    </span>
                  </div>
                ))}
                {matchups?.games.length === 0 && (
                  <p className="text-gray-400 text-sm py-4 text-center">No games found.</p>
                )}
              </div>
            </details>
          </div>
        </>
      )}

      {/* Lineup analysis tab */}
      {activeTab === 'lineup' && (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top Lineups</h2>
                <p className="text-xs text-gray-400 mt-0.5">5-player combinations with at least 5 tracked events</p>
              </div>
              <Link to={`/teams/${teamId}/analytics/on-off`} className="text-sm text-brand-600 hover:underline">
                On/Off Analysis →
              </Link>
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

          {/* Player Combinations section */}
          <div className="mt-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Player Combinations</h2>
                <p className="text-xs text-gray-400 mt-0.5">Sorted by points scored together</p>
              </div>
              {/* Toggle */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                {(['2', '3'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setComboSize(s)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      comboSize === s
                        ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500'
                    }`}
                  >
                    {s}-man
                  </button>
                ))}
              </div>
            </div>
            {comboStats.length === 0 ? (
              <p className="text-center text-gray-400 py-6 text-sm">No combination data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Players</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">PTS</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Events</th>
                      <th className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">PTS/50</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {comboStats.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 text-xs">
                          {c.playerIds.map((id) => playerNameMap.get(id) ?? id.slice(0, 8)).join(' · ')}
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-gray-900 dark:text-gray-100">{c.pts}</td>
                        <td className="px-3 py-2.5 text-center text-gray-500">{c.eventsTogether}</td>
                        <td className="px-3 py-2.5 text-center text-gray-500">{c.ptsPer50.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* AI Insights tab */}
      {activeTab === 'ai' && (
        <AiInsightsTab teamId={teamId!} />
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
