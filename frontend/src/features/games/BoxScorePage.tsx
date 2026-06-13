import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { GameFlowChart } from '../../components/charts/GameFlowChart';

interface FourFactors {
  efgPct: number | null;
  tovPct: number | null;
  orebPct: number | null;
  ftRate: number | null;
}

interface TeamMetrics {
  pip: number;
  pot: number;
  secondChancePoints: number;
  benchPoints: number | null;
  ppp: number | null;
}

interface BoxRow {
  playerId: string;
  playerName: string | null;
  jerseyNumber: number | null;
  teamId: string | null;
  isHomeTeam: boolean;
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
  minutesDisplay?: string;
  fourFactors?: FourFactors | null;
  teamMetrics?: TeamMetrics | null;
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

interface FlowData {
  flowPoints: { period: number; clockTimeSeconds: number | null; homeScore: number; awayScore: number; differential: number }[];
  scoringRuns: { teamId: string; points: number; startPeriod: number; endPeriod: number }[];
}

type SortKey = keyof Pick<BoxRow, 'pts' | 'reb' | 'ast' | 'to' | 'stl' | 'blk' | 'pf' | 'fga' | 'plusMinus' | 'efgPct'>;

function pct(n: number | null): string {
  if (n === null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function totals(rows: BoxRow[]) {
  const sum = (key: keyof BoxRow) => rows.reduce((acc, r) => acc + ((r[key] as number) ?? 0), 0);
  const t = {
    pts: sum('pts'), fgm: sum('fgm'), fga: sum('fga'),
    threepm: sum('threepm'), threepa: sum('threepa'),
    ftm: sum('ftm'), fta: sum('fta'),
    reb: sum('reb'), ast: sum('ast'), to: sum('to'),
    stl: sum('stl'), blk: sum('blk'), pf: sum('pf'),
  };
  return {
    ...t,
    fgPct: t.fga > 0 ? t.fgm / t.fga : null,
    threePct: t.threepa > 0 ? t.threepm / t.threepa : null,
    ftPct: t.fta > 0 ? t.ftm / t.fta : null,
    efgPct: t.fga > 0 ? (t.fgm + 0.5 * t.threepm) / t.fga : null,
  };
}

function BoxTable({ rows, label }: { rows: BoxRow[]; label: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('pts');
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const av = (a[sortKey] as number) ?? -Infinity;
        const bv = (b[sortKey] as number) ?? -Infinity;
        return sortAsc ? av - bv : bv - av;
      }),
    [rows, sortKey, sortAsc],
  );

  const tot = totals(rows);

  const col = (key: SortKey, title: string) => (
    <th
      className="px-3 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-300 select-none"
      onClick={() => { if (sortKey === key) setSortAsc((a) => !a); else { setSortKey(key); setSortAsc(false); } }}
    >
      {title}{sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 px-1">{label}</h2>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-card">
        <table className="w-full text-sm bg-white dark:bg-gray-900">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 dark:bg-gray-800 min-w-[120px]">Player</th>
              <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">MIN</th>
              {col('pts', 'PTS')}
              <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">FG</th>
              <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">FG%</th>
              <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">3P</th>
              <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">3P%</th>
              <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">FT</th>
              <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">FT%</th>
              {col('reb', 'REB')}
              {col('ast', 'AST')}
              {col('to', 'TO')}
              {col('stl', 'STL')}
              {col('blk', 'BLK')}
              {col('pf', 'PF')}
              {col('efgPct', 'eFG%')}
              {col('plusMinus', '+/-')}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map((row) => (
              <tr key={row.playerId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2.5 font-medium sticky left-0 bg-white dark:bg-gray-900">
                  <span className="text-gray-400 font-mono text-xs mr-1.5">
                    #{row.jerseyNumber ?? '?'}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100 text-sm">
                    {row.playerName ?? row.playerId.slice(0, 8)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.minutesDisplay ?? '—'}</td>
                <td className="px-3 py-2.5 text-center font-bold text-gray-900 dark:text-gray-100">{row.pts}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.fgm}/{row.fga}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{pct(row.fgPct)}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.threepm}/{row.threepa}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{pct(row.threePct)}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.ftm}/{row.fta}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{pct(row.ftPct)}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.reb}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.ast}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.to}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.stl}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.blk}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.pf}</td>
                <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{pct(row.efgPct)}</td>
                <td className={`px-3 py-2.5 text-center font-medium ${row.plusMinus > 0 ? 'text-green-600' : row.plusMinus < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {row.plusMinus > 0 ? `+${row.plusMinus}` : row.plusMinus}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700">
            <tr className="font-semibold text-gray-700 dark:text-gray-300">
              <td className="px-4 py-2.5 sticky left-0 bg-gray-50 dark:bg-gray-800 text-xs uppercase tracking-wide">Team</td>
              <td className="px-3 py-2.5 text-center">—</td>
              <td className="px-3 py-2.5 text-center">{tot.pts}</td>
              <td className="px-3 py-2.5 text-center text-xs">{tot.fgm}/{tot.fga}</td>
              <td className="px-3 py-2.5 text-center text-xs">{pct(tot.fgPct)}</td>
              <td className="px-3 py-2.5 text-center text-xs">{tot.threepm}/{tot.threepa}</td>
              <td className="px-3 py-2.5 text-center text-xs">{pct(tot.threePct)}</td>
              <td className="px-3 py-2.5 text-center text-xs">{tot.ftm}/{tot.fta}</td>
              <td className="px-3 py-2.5 text-center text-xs">{pct(tot.ftPct)}</td>
              <td className="px-3 py-2.5 text-center">{tot.reb}</td>
              <td className="px-3 py-2.5 text-center">{tot.ast}</td>
              <td className="px-3 py-2.5 text-center">{tot.to}</td>
              <td className="px-3 py-2.5 text-center">{tot.stl}</td>
              <td className="px-3 py-2.5 text-center">{tot.blk}</td>
              <td className="px-3 py-2.5 text-center">{tot.pf}</td>
              <td className="px-3 py-2.5 text-center text-xs">{pct(tot.efgPct)}</td>
              <td className="px-3 py-2.5 text-center">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <TeamStatsStrip row={rows[0]} />
    </div>
  );
}

// N-03/N-04 — compact team stats strip (four factors + scoring-context
// metrics); values are repeated on every row of the team, so any row works.
function TeamStatsStrip({ row }: { row: BoxRow | undefined }) {
  const ff = row?.fourFactors;
  const tm = row?.teamMetrics;
  if (!ff && !tm) return null;

  const fmtPct = (v: number | null | undefined) => (v != null ? `${(v * 100).toFixed(1)}%` : '—');
  const fmtNum = (v: number | null | undefined, decimals = 0) =>
    v != null ? v.toFixed(decimals) : '—';

  const chips: { label: string; value: string; tip: string }[] = [
    ...(ff
      ? [
          { label: 'eFG%', value: fmtPct(ff.efgPct), tip: 'Effective FG%' },
          { label: 'TOV%', value: fmtPct(ff.tovPct), tip: 'Turnover rate (lower is better)' },
          { label: 'ORB%', value: fmtPct(ff.orebPct), tip: 'Offensive rebound share' },
          { label: 'FTr', value: fmtNum(ff.ftRate, 2), tip: 'Free throw rate (FTA/FGA)' },
        ]
      : []),
    ...(tm
      ? [
          { label: 'PIP', value: fmtNum(tm.pip), tip: 'Points in the paint' },
          { label: 'Pts off TO', value: fmtNum(tm.pot), tip: 'Points off turnovers' },
          { label: '2nd Chance', value: fmtNum(tm.secondChancePoints), tip: 'Second-chance points' },
          { label: 'Bench', value: fmtNum(tm.benchPoints), tip: 'Bench points (needs an initial lineup)' },
          { label: 'PPP', value: fmtNum(tm.ppp, 2), tip: 'Points per possession' },
        ]
      : []),
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-2 px-1" data-testid="team-stats-strip">
      {chips.map((c) => (
        <span
          key={c.label}
          title={c.tip}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-xs"
        >
          <span className="text-gray-500">{c.label}</span>
          <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{c.value}</span>
        </span>
      ))}
    </div>
  );
}

export default function BoxScorePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [recap, setRecap] = useState<string | null>(null);
  const [recapStyle, setRecapStyle] = useState<'formal' | 'casual' | 'social'>('casual');
  const [showFlow, setShowFlow] = useState(false);

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

  const { data: flowData } = useQuery<FlowData>({
    queryKey: ['game-flow', gameId],
    queryFn: () => api.get(`/games/${gameId}/flow`),
    enabled: showFlow,
  });

  const homeRows = boxRows.filter((r) => r.isHomeTeam);
  const awayRows = boxRows.filter((r) => !r.isHomeTeam);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={-1 as never} className="text-gray-400 hover:text-gray-600 text-sm">← Back</Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Box Score</h1>
          {game && (
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date(game.date).toLocaleDateString()}
              {game.location ? ` · ${game.location}` : ''}
              {game.finalScoreHome !== null ? ` · ${game.finalScoreHome}–${game.finalScoreAway}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Link to={`/games/${gameId}/log`} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">Game Log</Link>
        <Link to={`/games/${gameId}/shots`} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">Shot Map</Link>
        <a href={`/api/v1/export/game/${gameId}/csv`} download className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg">Export CSV</a>
        <a href={`/api/v1/export/game/${gameId}/json`} download className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg">Export JSON</a>
        <button onClick={() => setShowFlow((v) => !v)} className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg">
          {showFlow ? 'Hide' : 'Show'} Game Flow
        </button>
        <select value={recapStyle} onChange={(e) => setRecapStyle(e.target.value as typeof recapStyle)} className="text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none">
          <option value="casual">Casual</option>
          <option value="formal">Formal</option>
          <option value="social">Social media</option>
        </select>
        <button onClick={() => recapMutation.mutate()} disabled={recapMutation.isPending} className="text-xs px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 rounded-lg disabled:opacity-60">
          {recapMutation.isPending ? 'Generating…' : 'AI Game Recap'}
        </button>
      </div>

      {recap && (
        <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider">AI Game Recap</p>
            <button onClick={() => setRecap(null)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{recap}</p>
        </div>
      )}

      {recapMutation.isError && (
        <p className="text-sm text-red-500 mb-4">Failed to generate recap. Check ANTHROPIC_API_KEY.</p>
      )}

      {showFlow && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Game Flow</h2>
          <GameFlowChart
            flowPoints={flowData?.flowPoints ?? []}
            scoringRuns={flowData?.scoringRuns ?? []}
          />
        </div>
      )}

      {isLoading && <p className="text-gray-500">Loading…</p>}

      {!isLoading && boxRows.length === 0 && (
        <p className="text-center text-gray-400 py-10">No stats recorded for this game yet.</p>
      )}

      {homeRows.length > 0 && <BoxTable rows={homeRows} label="Home Team" />}
      {awayRows.length > 0 && <BoxTable rows={awayRows} label="Away Team" />}
    </div>
  );
}
