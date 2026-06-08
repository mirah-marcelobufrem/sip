import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
}

interface OnOffSplit {
  pts: number;
  oppPts: number;
  plusMinus: number;
  possessions: number | null;
}

interface OnOffData {
  playerId: string;
  onCourt: OnOffSplit;
  offCourt: OnOffSplit;
}

function Delta({ value }: { value: number }) {
  const sign = value >= 0 ? '+' : '';
  return (
    <span className={value > 0 ? 'text-green-600 font-medium' : value < 0 ? 'text-red-500 font-medium' : 'text-gray-400'}>
      {sign}{value}
    </span>
  );
}

export default function OnOffPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  const { data: players = [] } = useQuery<Player[]>({
    queryKey: ['players', teamId],
    queryFn: () => api.get(`/teams/${teamId}/players`),
  });

  const { data: onOffData, isLoading } = useQuery<OnOffData>({
    queryKey: ['on-off', teamId, selectedPlayerId],
    queryFn: () => api.get(`/teams/${teamId}/on-off/${selectedPlayerId}`),
    enabled: !!selectedPlayerId,
  });

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  const onDelta = onOffData
    ? {
        pts: onOffData.onCourt.pts - onOffData.offCourt.pts,
        oppPts: onOffData.onCourt.oppPts - onOffData.offCourt.oppPts,
        plusMinus: onOffData.onCourt.plusMinus - onOffData.offCourt.plusMinus,
      }
    : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to={`/teams/${teamId}/analytics`}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
        >
          Analytics
        </Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">On/Off Analysis</h1>
      </div>

      {/* Player selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Player:</label>
        <select
          value={selectedPlayerId}
          onChange={(e) => setSelectedPlayerId(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">— select a player —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.jerseyNumber !== null ? `#${p.jerseyNumber} ` : ''}{p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* Empty state */}
      {!selectedPlayerId && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center shadow-card">
          <p className="text-gray-400 text-sm">Select a player to view on/off splits</p>
        </div>
      )}

      {/* Loading state */}
      {selectedPlayerId && isLoading && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center shadow-card">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      )}

      {/* Data table */}
      {onOffData && selectedPlayer && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {selectedPlayer.firstName} {selectedPlayer.lastName} — On/Off Splits
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Split</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">PTS</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">OPP PTS</th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">+/-</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">On Court</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">
                    {onOffData.onCourt.pts}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                    {onOffData.onCourt.oppPts}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Delta value={onOffData.onCourt.plusMinus} />
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">Off Court</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">
                    {onOffData.offCourt.pts}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                    {onOffData.offCourt.oppPts}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Delta value={onOffData.offCourt.plusMinus} />
                  </td>
                </tr>
                {/* Delta row */}
                {onDelta && (
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Delta (On − Off)</td>
                    <td className="px-4 py-3 text-center">
                      <Delta value={onDelta.pts} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Delta value={onDelta.oppPts} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Delta value={onDelta.plusMinus} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
