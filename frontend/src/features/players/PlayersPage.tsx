import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

export default function PlayersPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jersey, setJersey] = useState('');
  const [position, setPosition] = useState('');

  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: ['players', teamId],
    queryFn: () => api.get(`/teams/${teamId}/players`),
  });

  const addMutation = useMutation({
    mutationFn: (data: object) => api.post(`/teams/${teamId}/players`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      setShowAdd(false);
      setFirstName('');
      setLastName('');
      setJersey('');
      setPosition('');
    },
  });

  const activePlayers = players.filter((p) => p.status !== 'hidden' && p.status !== 'transferred');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Roster</h1>
          <p className="text-sm text-gray-500 mt-0.5">{activePlayers.length} active players</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
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

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Player</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addMutation.mutate({
                  firstName,
                  lastName,
                  jerseyNumber: jersey !== '' ? Number(jersey) : undefined,
                  position: position || undefined,
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First name</label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last name</label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jersey #</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={jersey}
                    onChange={(e) => setJersey(e.target.value)}
                    placeholder="0–99"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Position</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">—</option>
                    {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {addMutation.isPending ? 'Adding…' : 'Add Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
