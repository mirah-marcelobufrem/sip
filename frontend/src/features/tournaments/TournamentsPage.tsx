import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface Tournament {
  id: string;
  name: string;
  format: string;
  numTeams: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  shareToken: string | null;
}

interface TeamOption {
  id: string;
  name: string;
}

const FORMAT_LABEL: Record<string, string> = {
  single_elimination: 'Single Elim',
  double_elimination: 'Double Elim',
  round_robin: 'Round Robin',
  mixed: 'Mixed',
};

const STATUS_COLOR: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function TeamToggle({ name, seed, onClick }: { name: string; seed: number | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
        seed
          ? 'ring-2 ring-brand-500 bg-brand-50 dark:bg-brand-900/20 text-gray-900 dark:text-gray-100'
          : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
      }`}
    >
      {seed && (
        <span className="w-5 h-5 flex items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold shrink-0">
          {seed}
        </span>
      )}
      <span className="font-medium truncate">{name}</span>
    </button>
  );
}

export default function TournamentsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [format, setFormat] = useState<string>('single_elimination');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: tournaments = [], isLoading } = useQuery<Tournament[]>({
    queryKey: ['tournaments'],
    queryFn: () => api.get('/tournaments'),
  });

  const { data: myTeams = [] } = useQuery<TeamOption[]>({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams'),
    enabled: showCreate,
  });

  const { data: opponentTeams = [] } = useQuery<TeamOption[]>({
    queryKey: ['opponent-teams'],
    queryFn: () => api.get('/opponent-teams'),
    enabled: showCreate,
  });

  const allTeams = [...myTeams, ...opponentTeams];

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/tournaments', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      setShowCreate(false);
      setName(''); setFormat('single_elimination'); setSelectedTeamIds([]);
      setStartDate(''); setEndDate('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tournaments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
  });

  function toggleTeam(id: string) {
    setSelectedTeamIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const teams = selectedTeamIds.map((id, i) => {
      const team = allTeams.find((t) => t.id === id);
      return { seed: i + 1, teamId: id, teamName: team?.name ?? `Team ${i + 1}` };
    });
    createMutation.mutate({
      name,
      format,
      numTeams: teams.length,
      teams,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
    });
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tournaments</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Tournament
        </button>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="space-y-3">
        {tournaments.map((t) => (
          <div key={t.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-4 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/tournaments/${t.id}`}
                  className="font-semibold text-gray-900 dark:text-gray-100 hover:text-brand-600 dark:hover:text-brand-400 truncate"
                >
                  {t.name}
                </Link>
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                  {FORMAT_LABEL[t.format] ?? t.format}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[t.status] ?? ''}`}>
                  {t.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {t.numTeams} teams
                {t.startDate && ` · ${new Date(t.startDate).toLocaleDateString()}`}
                {t.endDate && ` – ${new Date(t.endDate).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/tournaments/${t.id}`}
                className="text-xs px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 rounded-lg transition-colors"
              >
                View bracket
              </Link>
              <button
                onClick={() => { if (confirm('Delete this tournament?')) deleteMutation.mutate(t.id); }}
                className="text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && !isLoading && (
          <p className="text-center text-gray-400 py-10">No tournaments yet. Create your first tournament.</p>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg shadow-elevated my-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">New Tournament</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  value={name} onChange={(e) => setName(e.target.value)} required
                  placeholder="e.g. City Championship 2026"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Format</label>
                <select
                  value={format} onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="single_elimination">Single Elimination</option>
                  <option value="double_elimination">Double Elimination</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Teams (select at least 2, in seed order)
                </label>
                {allTeams.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-2">
                    No teams available — add a team or opponent team first.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto pr-1">
                    {allTeams.map((team) => {
                      const seed = selectedTeamIds.indexOf(team.id);
                      return (
                        <TeamToggle
                          key={team.id}
                          name={team.name}
                          seed={seed === -1 ? null : seed + 1}
                          onClick={() => toggleTeam(team.id)}
                        />
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500 pt-1">
                  {selectedTeamIds.length} team{selectedTeamIds.length === 1 ? '' : 's'} selected
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button
                  type="submit" disabled={createMutation.isPending || selectedTeamIds.length < 2}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Tournament'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
