import { useState } from 'react';
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

interface Roster {
  id: string;
  name: string;
  seasonLabel: string | null;
  isDefault: boolean;
  playerIds: string[];
}

// U-04 roster manager — a team has N rosters; membership is edited by toggling
// the team's players (R6: only the team's own players are selectable here).
export default function RosterManager({ teamId, players }: { teamId: string; players: Player[] }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: rosters = [] } = useQuery<Roster[]>({
    queryKey: ['rosters', teamId],
    queryFn: () => api.get(`/teams/${teamId}/rosters`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['rosters', teamId] });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; seasonLabel?: string; copyFromRosterId?: string }) =>
      api.post(`/teams/${teamId}/rosters`, data),
    onSuccess: () => { invalidate(); setShowCreate(false); },
  });

  const setPlayersMutation = useMutation({
    mutationFn: ({ rosterId, playerIds }: { rosterId: string; playerIds: string[] }) =>
      api.put(`/teams/${teamId}/rosters/${rosterId}/players`, { playerIds }),
    onSuccess: invalidate,
  });

  const editing = rosters.find((r) => r.id === editingId) ?? null;

  return (
    <section className="mt-8" data-testid="roster-manager">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rosters</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
        >
          + New Roster
        </button>
      </div>

      <div className="space-y-2">
        {rosters.map((r) => (
          <button
            key={r.id}
            data-testid="roster-row"
            onClick={() => setEditingId(r.id)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {r.name}
              {r.isDefault && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400">Default</span>
              )}
            </span>
            <span className="text-sm text-gray-400">{r.playerIds.length} players</span>
          </button>
        ))}
        {rosters.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">No rosters yet.</p>
        )}
      </div>

      {/* Create roster modal */}
      {showCreate && (
        <CreateRosterModal
          rosters={rosters}
          isPending={createMutation.isPending}
          onCancel={() => setShowCreate(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />
      )}

      {/* Edit membership modal */}
      {editing && (
        <EditMembershipModal
          roster={editing}
          players={players}
          isPending={setPlayersMutation.isPending}
          onCancel={() => setEditingId(null)}
          onSave={(playerIds) => {
            setPlayersMutation.mutate(
              { rosterId: editing.id, playerIds },
              { onSuccess: () => setEditingId(null) },
            );
          }}
        />
      )}
    </section>
  );
}

function CreateRosterModal({
  rosters,
  isPending,
  onCancel,
  onSubmit,
}: {
  rosters: Roster[];
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (data: { name: string; seasonLabel?: string; copyFromRosterId?: string }) => void;
}) {
  const [name, setName] = useState('');
  const [seasonLabel, setSeasonLabel] = useState('');
  const [copyFrom, setCopyFrom] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated">
        <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">New Roster</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name,
              seasonLabel: seasonLabel || undefined,
              copyFromRosterId: copyFrom || undefined,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="roster-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              id="roster-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. U18 Travel Squad"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="roster-season" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Season label (optional)</label>
            <input
              id="roster-season"
              value={seasonLabel}
              onChange={(e) => setSeasonLabel(e.target.value)}
              placeholder="e.g. 2025–26"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {rosters.length > 0 && (
            <div>
              <label htmlFor="roster-copy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Copy players from</label>
              <select
                id="roster-copy"
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— start empty —</option>
                {rosters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button
              type="submit"
              disabled={isPending || !name}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {isPending ? 'Creating…' : 'Create Roster'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditMembershipModal({
  roster,
  players,
  isPending,
  onCancel,
  onSave,
}: {
  roster: Roster;
  players: Player[];
  isPending: boolean;
  onCancel: () => void;
  onSave: (playerIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(roster.playerIds);
  const selectable = players.filter((p) => p.status !== 'transferred');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-elevated flex flex-col max-h-[90vh]">
        <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{roster.name}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{selected.length} players selected</p>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4 space-y-2">
          {selectable.map((p) => {
            const isOn = selected.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                data-testid="roster-player-toggle"
                onClick={() =>
                  setSelected((prev) => (isOn ? prev.filter((id) => id !== p.id) : [...prev, p.id]))
                }
                className={`w-full rounded-lg px-3 py-2 text-sm flex items-center gap-2 text-left transition-colors ${
                  isOn
                    ? 'ring-2 ring-brand-500 bg-brand-50 dark:bg-brand-900/20 text-gray-900 dark:text-gray-100'
                    : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="w-7 text-center font-mono text-xs text-gray-400 shrink-0">
                  {p.jerseyNumber != null ? `#${p.jerseyNumber}` : '—'}
                </span>
                <span className="font-medium">{p.firstName} {p.lastName}</span>
                {p.position && <span className="ml-auto text-xs text-gray-400">{p.position}</span>}
              </button>
            );
          })}
          {selectable.length === 0 && (
            <p className="text-sm text-gray-400 py-4 text-center">No players to add.</p>
          )}
        </div>
        <div className="flex gap-2 justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            type="button"
            onClick={() => onSave(selected)}
            disabled={isPending}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save Roster'}
          </button>
        </div>
      </div>
    </div>
  );
}
