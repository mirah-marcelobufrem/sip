import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

interface Team {
  id: string;
  name: string;
  season: string | null;
  sportLevel: string | null;
  active: boolean;
}

interface Member {
  userId: string;
  email: string;
  role: string;
}

const ROLE_OPTIONS = ['COACH', 'ASSISTANT', 'SCOUT', 'VIEWER'];
const ROLE_BADGE: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700',
  COACH: 'bg-brand-100 text-brand-700',
  ASSISTANT: 'bg-blue-100 text-blue-700',
  SCOUT: 'bg-yellow-100 text-yellow-700',
  VIEWER: 'bg-gray-100 text-gray-600',
};

function MembersModal({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('COACH');
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['team-members', teamId],
    queryFn: () => api.get(`/teams/${teamId}/members`),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/teams/${teamId}/members/${userId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members', teamId] }),
  });

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) => api.post<{ token: string }>(`/teams/${teamId}/invitations`, data),
    onSuccess: (data) => {
      setInviteToken(data.token);
      setInviteEmail('');
    },
  });

  const { user } = useAuthStore.getState();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg shadow-elevated max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Members</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-auto space-y-2 mb-4">
          {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{m.email}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[m.role] ?? 'bg-gray-100 text-gray-600'}`}>{m.role}</span>
              {m.role !== 'OWNER' && m.userId !== user?.id && (
                <button
                  onClick={() => removeMutation.mutate(m.userId)}
                  disabled={removeMutation.isPending}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && !isLoading && (
            <p className="text-sm text-gray-400 text-center py-4">No members found</p>
          )}
        </div>

        {/* Invite section */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Invite Member</p>
          {inviteToken ? (
            <div className="space-y-2">
              <p className="text-xs text-green-600 dark:text-green-400">Invitation created. Share this token:</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{inviteToken}</code>
                <button
                  onClick={() => { void navigator.clipboard.writeText(inviteToken); }}
                  className="text-xs px-3 py-2 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 shrink-0"
                >
                  Copy
                </button>
              </div>
              <button onClick={() => setInviteToken(null)} className="text-xs text-gray-400 hover:text-gray-600">New invite</button>
            </div>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (!inviteEmail) return;
              inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
            }} className="flex gap-2">
              <input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800"
              >
                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <button
                type="submit"
                disabled={inviteMutation.isPending}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium disabled:opacity-60"
              >
                Invite
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [membersTeamId, setMembersTeamId] = useState<string | null>(null);

  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; season: string }) => api.post('/teams', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreate(false);
      setName('');
      setSeason('');
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Teams</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Team
        </button>
      </div>

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div key={team.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-card hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-lg flex items-center justify-center text-xl">
                🏀
              </div>
              {!team.active && (
                <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">Archived</span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{team.name}</h3>
            {team.season && <p className="text-sm text-gray-500 dark:text-gray-400">{team.season}</p>}
            <div className="flex gap-2 mt-4">
              <Link
                to={`/teams/${team.id}/players`}
                className="flex-1 text-center text-xs py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Roster
              </Link>
              <Link
                to={`/teams/${team.id}/games`}
                className="flex-1 text-center text-xs py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 rounded-lg transition-colors"
              >
                Games
              </Link>
              <Link
                to={`/teams/${team.id}/analytics`}
                className="flex-1 text-center text-xs py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Analytics
              </Link>
              <button
                onClick={() => setMembersTeamId(team.id)}
                className="flex-1 text-center text-xs py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Members
              </button>
            </div>
          </div>
        ))}
      </div>

      {membersTeamId && (
        <MembersModal teamId={membersTeamId} onClose={() => setMembersTeamId(null)} />
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-elevated">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Create Team</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate({ name, season });
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="create-team-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team name</label>
                <input
                  id="create-team-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Season</label>
                <input
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  placeholder="2025-26"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {createMutation.isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
