import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface OpponentTeam {
  id: string;
  name: string;
  homeCourt: string | null;
  contactName: string | null;
  contactEmail: string | null;
  playerCount?: number;
}

interface OpponentTeamFormValues {
  name: string;
  homeCourt: string;
  contactName: string;
  contactEmail: string;
}

const EMPTY_FORM: OpponentTeamFormValues = {
  name: '',
  homeCourt: '',
  contactName: '',
  contactEmail: '',
};

function OpponentTeamForm({
  initialValues,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  initialValues: OpponentTeamFormValues;
  onSubmit: (values: OpponentTeamFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [values, setValues] = useState<OpponentTeamFormValues>(initialValues);

  function set(field: keyof OpponentTeamFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
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
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Team name <span className="text-red-500">*</span>
        </label>
        <input
          value={values.name}
          onChange={set('name')}
          required
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Home court</label>
        <input
          value={values.homeCourt}
          onChange={set('homeCourt')}
          placeholder="Arena or gym name"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact name</label>
          <input
            value={values.contactName}
            onChange={set('contactName')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contact email</label>
          <input
            type="email"
            value={values.contactEmail}
            onChange={set('contactEmail')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 dark:text-gray-100"
          />
        </div>
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

export default function OpponentTeamsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingTeam, setEditingTeam] = useState<OpponentTeam | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: teams = [], isLoading } = useQuery<OpponentTeam[]>({
    queryKey: ['opponent-teams'],
    queryFn: () => api.get('/opponent-teams'),
  });

  const createMutation = useMutation({
    mutationFn: (data: OpponentTeamFormValues) =>
      api.post('/opponent-teams', {
        name: data.name,
        homeCourt: data.homeCourt || null,
        contactName: data.contactName || null,
        contactEmail: data.contactEmail || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent-teams'] });
      setShowCreate(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: OpponentTeamFormValues }) =>
      api.put(`/opponent-teams/${id}`, {
        name: data.name,
        homeCourt: data.homeCourt || null,
        contactName: data.contactName || null,
        contactEmail: data.contactEmail || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent-teams'] });
      setEditingTeam(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/opponent-teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent-teams'] });
      setDeletingId(null);
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Opponent Teams</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{teams.length} teams tracked</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Add Opponent
        </button>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Team</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Home court</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Contact</th>
              <th className="px-4 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {teams.map((team) => (
              <tr
                key={team.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                onClick={() => navigate(`/opponent-teams/${team.id}`)}
              >
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {team.name}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {team.homeCourt ?? '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                  {team.contactName ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setEditingTeam(team)}
                      className="text-xs text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeletingId(team.id)}
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
        {teams.length === 0 && !isLoading && (
          <p className="text-center text-gray-400 py-10">
            No opponent teams yet. Add your first opponent.
          </p>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Add Opponent Team</h2>
            <OpponentTeamForm
              initialValues={EMPTY_FORM}
              onSubmit={(values) => createMutation.mutate(values)}
              onCancel={() => setShowCreate(false)}
              isPending={createMutation.isPending}
              submitLabel="Add Team"
            />
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Edit Opponent Team</h2>
            <OpponentTeamForm
              initialValues={{
                name: editingTeam.name,
                homeCourt: editingTeam.homeCourt ?? '',
                contactName: editingTeam.contactName ?? '',
                contactEmail: editingTeam.contactEmail ?? '',
              }}
              onSubmit={(values) => editMutation.mutate({ id: editingTeam.id, data: values })}
              onCancel={() => setEditingTeam(null)}
              isPending={editMutation.isPending}
              submitLabel="Save Changes"
            />
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-sm shadow-elevated">
            <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Delete opponent team?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This will permanently delete the team and all associated players. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingId)}
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
