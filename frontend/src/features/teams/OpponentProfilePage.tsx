import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface OpponentTeam {
  id: string;
  name: string;
  homeCourt: string | null;
  contactName: string | null;
  contactEmail: string | null;
}

interface OpponentPlayer {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  position: string | null;
  heightCm: number | null;
  weightKg: number | null;
  notes: string | null;
}

interface OpponentPlayerFormValues {
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  position: string;
  heightCm: string;
  weightKg: string;
  notes: string;
}

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

const EMPTY_PLAYER_FORM: OpponentPlayerFormValues = {
  firstName: '',
  lastName: '',
  jerseyNumber: '',
  position: '',
  heightCm: '',
  weightKg: '',
  notes: '',
};

function OpponentPlayerForm({
  initialValues,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  initialValues: OpponentPlayerFormValues;
  onSubmit: (values: OpponentPlayerFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [values, setValues] = useState<OpponentPlayerFormValues>(initialValues);

  function set(field: keyof OpponentPlayerFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            First name <span className="text-red-500">*</span>
          </label>
          <input
            value={values.firstName}
            onChange={set('firstName')}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Last name <span className="text-red-500">*</span>
          </label>
          <input
            value={values.lastName}
            onChange={set('lastName')}
            required
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jersey #</label>
          <input
            type="number"
            min={0}
            max={99}
            value={values.jerseyNumber}
            onChange={set('jerseyNumber')}
            placeholder="0–99"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Position</label>
          <select
            value={values.position}
            onChange={set('position')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
          >
            <option value="">—</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Height (cm)</label>
          <input
            type="number"
            min={100}
            max={250}
            value={values.heightCm}
            onChange={set('heightCm')}
            placeholder="185"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Weight (kg)</label>
        <input
          type="number"
          min={30}
          max={200}
          value={values.weightKg}
          onChange={set('weightKg')}
          placeholder="90"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
        <textarea
          value={values.notes}
          onChange={set('notes')}
          rows={2}
          placeholder="Tendencies, strengths, weaknesses…"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100 resize-none"
        />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
        >
          {isPending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function playerToFormValues(player: OpponentPlayer): OpponentPlayerFormValues {
  return {
    firstName: player.firstName,
    lastName: player.lastName,
    jerseyNumber: player.jerseyNumber?.toString() ?? '',
    position: player.position ?? '',
    heightCm: player.heightCm?.toString() ?? '',
    weightKg: player.weightKg?.toString() ?? '',
    notes: player.notes ?? '',
  };
}

function formValuesToPayload(values: OpponentPlayerFormValues) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    jerseyNumber: values.jerseyNumber !== '' ? Number(values.jerseyNumber) : null,
    position: values.position || null,
    heightCm: values.heightCm !== '' ? Number(values.heightCm) : null,
    weightKg: values.weightKg !== '' ? Number(values.weightKg) : null,
    notes: values.notes || null,
  };
}

export default function OpponentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<OpponentPlayer | null>(null);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);

  const { data: team, isLoading: teamLoading } = useQuery<OpponentTeam>({
    queryKey: ['opponent-team', id],
    queryFn: () => api.get(`/opponent-teams/${id}`),
    enabled: !!id,
  });

  const { data: players = [], isLoading: playersLoading } = useQuery<OpponentPlayer[]>({
    queryKey: ['opponent-team-players', id],
    queryFn: () => api.get(`/opponent-teams/${id}/players`),
    enabled: !!id,
  });

  const addMutation = useMutation({
    mutationFn: (data: OpponentPlayerFormValues) =>
      api.post(`/opponent-teams/${id}/players`, formValuesToPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent-team-players', id] });
      setShowAdd(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ playerId, data }: { playerId: string; data: OpponentPlayerFormValues }) =>
      api.put(`/opponent-teams/${id}/players/${playerId}`, formValuesToPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent-team-players', id] });
      setEditingPlayer(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (playerId: string) => api.delete(`/opponent-teams/${id}/players/${playerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent-team-players', id] });
      setDeletingPlayerId(null);
    },
  });

  if (teamLoading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-6">
        <p className="text-red-500">Team not found.</p>
        <Link to="/opponent-teams" className="text-sm text-brand-600 dark:text-brand-400 hover:underline mt-2 inline-block">
          Back to opponents
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          to="/opponent-teams"
          className="text-sm text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
        >
          Opponents
        </Link>
        <span className="text-sm text-gray-400 mx-2">/</span>
        <span className="text-sm text-gray-700 dark:text-gray-300">{team.name}</span>
      </div>

      {/* Team header */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-card mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{team.name}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-0.5">Home court</span>
            <span className="text-gray-800 dark:text-gray-200">{team.homeCourt ?? '—'}</span>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-0.5">Contact</span>
            <span className="text-gray-800 dark:text-gray-200">{team.contactName ?? '—'}</span>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-0.5">Email</span>
            {team.contactEmail ? (
              <a
                href={`mailto:${team.contactEmail}`}
                className="text-brand-600 dark:text-brand-400 hover:underline"
              >
                {team.contactEmail}
              </a>
            ) : (
              <span className="text-gray-800 dark:text-gray-200">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Players section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Players{' '}
          <span className="text-sm font-normal text-gray-400">({players.length})</span>
        </h2>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Add Player
        </button>
      </div>

      {playersLoading && <p className="text-gray-500">Loading players…</p>}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pos</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Height</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Weight</th>
              <th className="px-4 py-3 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {players.map((player) => (
              <tr key={player.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 font-mono text-gray-500">{player.jerseyNumber ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {player.firstName} {player.lastName}
                  {player.notes && (
                    <span
                      className="ml-2 text-xs text-gray-400 hidden sm:inline"
                      title={player.notes}
                    >
                      Note
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500">{player.position ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                  {player.heightCm ? `${player.heightCm} cm` : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                  {player.weightKg ? `${player.weightKg} kg` : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEditingPlayer(player)}
                      className="text-xs text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingPlayerId(player.id)}
                      className="text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length === 0 && !playersLoading && (
          <p className="text-center text-gray-400 py-10">No players yet. Add the first opponent player.</p>
        )}
      </div>

      {/* Add player modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Player</h2>
            <OpponentPlayerForm
              initialValues={EMPTY_PLAYER_FORM}
              onSubmit={(values) => addMutation.mutate(values)}
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
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit Player</h2>
            <OpponentPlayerForm
              initialValues={playerToFormValues(editingPlayer)}
              onSubmit={(values) =>
                editMutation.mutate({ playerId: editingPlayer.id, data: values })
              }
              onCancel={() => setEditingPlayer(null)}
              isPending={editMutation.isPending}
              submitLabel="Save Changes"
            />
          </div>
        </div>
      )}

      {/* Delete player confirm */}
      {deletingPlayerId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-sm shadow-elevated">
            <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Delete player?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This will permanently remove the player from the opponent roster.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeletingPlayerId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingPlayerId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
