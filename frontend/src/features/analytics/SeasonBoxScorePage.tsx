import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

function buildQuery(params: Record<string, string | undefined>): string {
  const p = Object.entries(params).filter(([, v]) => v != null) as [string, string][];
  if (p.length === 0) return '';
  return '?' + new URLSearchParams(p).toString();
}

interface PlayerSeasonRow {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    jerseyNumber: number | null;
  };
  box: {
    pts: number;
    fgm: number;
    fga: number;
    threepm?: number;
    threepa?: number;
    ftm?: number;
    fta?: number;
    oreb?: number;
    dreb?: number;
    reb: number;
    ast: number;
    to: number;
    stl?: number;
    blk?: number;
    pf?: number;
    minSeconds?: number;
  } | null;
  derived: {
    fgPct: number | null;
    ptsPerGame: number;
    rebPerGame: number;
    astPerGame: number;
  } | null;
  gamesPlayed: number;
}

type ViewMode = 'avg' | 'totals';
// N-13 — normalization basis: off, per-40 (FIBA regulation) or per-36 (NBA convention)
type PerMode = 'off' | '40' | '36';

type SortKey =
  | 'gamesPlayed'
  | 'pts'
  | 'fgm'
  | 'fga'
  | 'threepm'
  | 'threepa'
  | 'ftm'
  | 'fta'
  | 'oreb'
  | 'dreb'
  | 'reb'
  | 'ast'
  | 'to'
  | 'stl'
  | 'blk'
  | 'pf'
  | 'minutes';

interface DataRow extends Record<SortKey, number> {
  playerId: string;
  name: string;
  jerseyNumber: number | null;
  fgPct: number | null;
  threePct: number | null;
  ftPct: number | null;
}

function pct(n: number | null): string {
  if (n === null || isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function divSafe(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

export default function SeasonBoxScorePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>('avg');
  const [sortKey, setSortKey] = useState<SortKey>('pts');
  const [sortAsc, setSortAsc] = useState(false);
  const [perMode, setPerMode] = useState<PerMode>('off');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: rows = [], isLoading } = useQuery<PlayerSeasonRow[]>({
    queryKey: ['player-season-stats', teamId, perMode, dateFrom, dateTo],
    queryFn: () =>
      api.get(
        `/teams/${teamId}/players/season-stats${buildQuery({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          per: perMode !== 'off' ? perMode : undefined,
        })}`
      ),
  });

  // Normalized values are already rates — never divide them by games played
  const normalized = perMode !== 'off';

  const dataRows = useMemo((): DataRow[] => {
    return rows
      .filter((r) => r.box !== null)
      .map((r) => {
        const gp = r.gamesPlayed || 1;
        const box = r.box!;

        const threepm = box.threepm ?? 0;
        const threepa = box.threepa ?? 0;
        const ftm = box.ftm ?? 0;
        const fta = box.fta ?? 0;
        const oreb = box.oreb ?? 0;
        const dreb = box.dreb ?? 0;
        const stl = box.stl ?? 0;
        const blk = box.blk ?? 0;
        const pf = box.pf ?? 0;
        // N-01 — the API exposes stint-derived minSeconds
        const minutes = (box.minSeconds ?? 0) / 60;

        const fgPct = box.fga > 0 ? box.fgm / box.fga : null;
        const threePct = threepa > 0 ? threepm / threepa : null;
        const ftPct = fta > 0 ? ftm / fta : null;

        if (viewMode === 'totals' || normalized) {
          return {
            playerId: r.player.id,
            name: `${r.player.firstName} ${r.player.lastName}`,
            jerseyNumber: r.player.jerseyNumber,
            gamesPlayed: r.gamesPlayed,
            minutes,
            pts: box.pts,
            fgm: box.fgm,
            fga: box.fga,
            fgPct,
            threepm,
            threepa,
            threePct,
            ftm,
            fta,
            ftPct,
            oreb,
            dreb,
            reb: box.reb,
            ast: box.ast,
            to: box.to,
            stl,
            blk,
            pf,
          };
        }

        // Per game averages
        return {
          playerId: r.player.id,
          name: `${r.player.firstName} ${r.player.lastName}`,
          jerseyNumber: r.player.jerseyNumber,
          gamesPlayed: r.gamesPlayed,
          minutes: divSafe(minutes, gp),
          pts: divSafe(box.pts, gp),
          fgm: divSafe(box.fgm, gp),
          fga: divSafe(box.fga, gp),
          fgPct,
          threepm: divSafe(threepm, gp),
          threepa: divSafe(threepa, gp),
          threePct,
          ftm: divSafe(ftm, gp),
          fta: divSafe(fta, gp),
          ftPct,
          oreb: divSafe(oreb, gp),
          dreb: divSafe(dreb, gp),
          reb: divSafe(box.reb, gp),
          ast: divSafe(box.ast, gp),
          to: divSafe(box.to, gp),
          stl: divSafe(stl, gp),
          blk: divSafe(blk, gp),
          pf: divSafe(pf, gp),
        };
      })
      .sort((a, b) => {
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        return sortAsc ? av - bv : bv - av;
      });
  }, [rows, viewMode, normalized, sortKey, sortAsc]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function ColHeader({ colKey, label }: { colKey: SortKey; label: string }) {
    const active = sortKey === colKey;
    return (
      <th
        className="px-3 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none whitespace-nowrap"
        onClick={() => handleSort(colKey)}
      >
        {label}
        {active ? (sortAsc ? ' ↑' : ' ↓') : ''}
      </th>
    );
  }

  const isAvg = viewMode === 'avg' && !normalized;
  const perSuffix = perMode === '40' ? '/40' : perMode === '36' ? '/36' : '';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={`/teams/${teamId}/analytics`}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
        >
          Analytics
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Season Box Score</h1>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* View mode toggle */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {([
            { id: 'avg' as const, label: 'Per Game Avg' },
            { id: 'totals' as const, label: 'Season Totals' },
          ]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setViewMode(opt.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === opt.id
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* N-13 — normalization control: Off | /40 (FIBA) | /36 */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {([
            { id: 'off' as const, label: 'Off' },
            { id: '40' as const, label: 'Per 40' },
            { id: '36' as const, label: 'Per 36' },
          ]).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setPerMode(opt.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                perMode === opt.id
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Date range filters */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">From:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">To:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {isLoading && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
      )}

      {!isLoading && dataRows.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center shadow-card">
          <p className="text-gray-400 text-sm">No season stats recorded yet.</p>
        </div>
      )}

      {dataRows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 shadow-card">
          <table className="w-full text-sm bg-white dark:bg-gray-900">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 dark:bg-gray-800 min-w-[140px]">
                  Player
                </th>
                <ColHeader colKey="gamesPlayed" label="GP" />
                <ColHeader colKey="minutes" label="MIN" />
                <ColHeader colKey="pts" label={`PTS${perSuffix}`} />
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  FGM/A
                </th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">
                  FG%
                </th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  3PM/A
                </th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">
                  3P%
                </th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                  FTM/A
                </th>
                <th className="px-3 py-3 text-xs font-medium text-gray-500 uppercase">
                  FT%
                </th>
                <ColHeader colKey="oreb" label={`OREB${perSuffix}`} />
                <ColHeader colKey="dreb" label={`DREB${perSuffix}`} />
                <ColHeader colKey="reb" label={`REB${perSuffix}`} />
                <ColHeader colKey="ast" label={`AST${perSuffix}`} />
                <ColHeader colKey="to" label={`TO${perSuffix}`} />
                <ColHeader colKey="stl" label={`STL${perSuffix}`} />
                <ColHeader colKey="blk" label={`BLK${perSuffix}`} />
                <ColHeader colKey="pf" label={`PF${perSuffix}`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {dataRows.map((row) => (
                <tr key={row.playerId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-gray-900 font-medium">
                    <span className="text-gray-400 font-mono text-xs mr-1.5">
                      #{row.jerseyNumber ?? '?'}
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">{row.name}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">{row.gamesPlayed}</td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {row.minutes > 0 ? fmt(row.minutes) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-gray-900 dark:text-gray-100">
                    {fmt(row.pts)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {isAvg ? `${fmt(row.fgm)}/${fmt(row.fga)}` : `${row.fgm}/${row.fga}`}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {pct(row.fgPct)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {isAvg ? `${fmt(row.threepm)}/${fmt(row.threepa)}` : `${row.threepm}/${row.threepa}`}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {pct(row.threePct)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {isAvg ? `${fmt(row.ftm)}/${fmt(row.fta)}` : `${row.ftm}/${row.fta}`}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {pct(row.ftPct)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {fmt(row.oreb)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {fmt(row.dreb)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {fmt(row.reb)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {fmt(row.ast)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {fmt(row.to)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {fmt(row.stl)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {fmt(row.blk)}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-600 dark:text-gray-400">
                    {fmt(row.pf)}
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
