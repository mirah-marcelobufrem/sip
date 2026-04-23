import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string | null;
  status: string;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  injured: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  hidden: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  transferred: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

export default function PlayersPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: ['players', teamId],
    queryFn: () => api.get(`/teams/${teamId}/players`),
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Roster</h1>
        <button className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors">
          + Add Player
        </button>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Position</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {players.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono text-gray-500">{p.jerseyNumber ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {p.firstName} {p.lastName}
                </td>
                <td className="px-4 py-3 text-gray-500">{p.position ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[p.status] ?? ''}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-xs text-gray-400 hover:text-gray-600">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && !isLoading && (
          <p className="text-center text-gray-400 py-10">No players yet. Add your first player.</p>
        )}
      </div>
    </div>
  );
}
