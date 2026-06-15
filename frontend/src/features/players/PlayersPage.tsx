import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import RosterManager from './RosterManager';

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
const STATUSES = ['active', 'injured', 'hidden', 'transferred'] as const;

function PlayerForm({
  initialValues,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  initialValues: { firstName: string; lastName: string; jersey: string; position: string; status: string };
  onSubmit: (values: typeof initialValues) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [firstName, setFirstName] = useState(initialValues.firstName);
  const [lastName, setLastName] = useState(initialValues.lastName);
  const [jersey, setJersey] = useState(initialValues.jersey);
  const [position, setPosition] = useState(initialValues.position);
  const [status, setStatus] = useState(initialValues.status);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ firstName, lastName, jersey, position, status });
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="add-player-first" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First name</label>
          <input
            id="add-player-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label htmlFor="add-player-last" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last name</label>
          <input
            id="add-player-last"
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
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
        >
          {isPending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function PlayersPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const csvText = await file.text();
    const { accessToken } = useAuthStore.getState();
    const res = await fetch(`/api/v1/teams/${teamId}/players/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv', 'Authorization': `Bearer ${accessToken}` },
      body: csvText,
    });
    const data = await res.json() as { imported: number; skipped: number };
    setCsvResult(data);
    queryClient.invalidateQueries({ queryKey: ['players', teamId] });
    queryClient.invalidateQueries({ queryKey: ['rosters', teamId] });
    e.target.value = '';
  };

  const { data: players = [], isLoading } = useQuery<Player[]>({
    queryKey: ['players', teamId],
    queryFn: () => api.get(`/teams/${teamId}/players`),
  });

  const addMutation = useMutation({
    mutationFn: (data: object) => api.post(`/teams/${teamId}/players`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      // New players join the default "Full Squad" roster — refresh the manager.
      queryClient.invalidateQueries({ queryKey: ['rosters', teamId] });
      setShowAdd(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.put(`/teams/${teamId}/players/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', teamId] });
      setEditingPlayer(null);
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
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + Add Player
          </button>
        </div>
      </div>

      {/* CSV result toast */}
      {csvResult && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm">
          <span className="text-green-700 dark:text-green-400">
            Imported {csvResult.imported} player{csvResult.imported !== 1 ? 's' : ''}{csvResult.skipped > 0 ? `, ${csvResult.skipped} skipped` : ''}
          </span>
          <button onClick={() => setCsvResult(null)} className="text-green-500 hover:text-green-700 ml-4">✕</button>
        </div>
      )}

      {/* Hidden CSV file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsvImport}
      />

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
                <td className="px-4 py-3 font-medium">
                  <Link
                    to={`/teams/${teamId}/players/${p.id}`}
                    className="text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                  >
                    {p.firstName} {p.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{p.position ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[p.status] ?? ''}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditingPlayer(p)}
                    className="text-xs text-gray-400 hover:text-brand-600 transition-colors"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && !isLoading && (
          <p className="text-center text-gray-400 py-10">No players yet. Add your first player.</p>
        )}
      </div>

      {/* U-04 — roster manager (create/copy rosters, edit membership) */}
      {teamId && <RosterManager teamId={teamId} players={players} />}

      {/* Add player modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Player</h2>
            <PlayerForm
              initialValues={{ firstName: '', lastName: '', jersey: '', position: '', status: 'active' }}
              onSubmit={({ firstName, lastName, jersey, position, status }) =>
                addMutation.mutate({
                  firstName,
                  lastName,
                  jerseyNumber: jersey !== '' ? Number(jersey) : undefined,
                  position: position || undefined,
                  status,
                })
              }
              onCancel={() => setShowAdd(false)}
              isPending={addMutation.isPending}
              submitLabel="Add Player"
            />
          </div>
        </div>
      )}

      {/* Edit player modal */}
      {editingPlayer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit Player</h2>
            <PlayerForm
              initialValues={{
                firstName: editingPlayer.firstName,
                lastName: editingPlayer.lastName,
                jersey: editingPlayer.jerseyNumber?.toString() ?? '',
                position: editingPlayer.position ?? '',
                status: editingPlayer.status,
              }}
              onSubmit={({ firstName, lastName, jersey, position, status }) =>
                editMutation.mutate({
                  id: editingPlayer.id,
                  data: {
                    firstName,
                    lastName,
                    jerseyNumber: jersey !== '' ? Number(jersey) : null,
                    position: position || null,
                    status,
                  },
                })
              }
              onCancel={() => setEditingPlayer(null)}
              isPending={editMutation.isPending}
              submitLabel="Save Changes"
            />
          </div>
        </div>
      )}
    </div>
  );
}
