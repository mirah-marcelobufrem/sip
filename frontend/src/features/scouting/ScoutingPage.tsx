import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { RadarChart } from '../../components/charts/RadarChart';

function AIScoutingAssist() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post<{ result: string }>('/ai/scouting-assist', { prompt }),
    onSuccess: (data) => setResult(data.result),
  });

  return (
    <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-xl p-4 mb-6">
      <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wider mb-3">AI Scouting Assistant</p>
      <div className="flex gap-2">
        <input
          value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what to improve or expand…"
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={() => mutation.mutate()} disabled={!prompt || mutation.isPending}
          className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
        >
          {mutation.isPending ? '…' : 'Ask AI'}
        </button>
      </div>
      {result && (
        <div className="mt-3">
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{result}</p>
          <button onClick={() => setResult(null)} className="text-xs text-gray-400 hover:text-gray-600 mt-2">Dismiss</button>
        </div>
      )}
    </div>
  );
}

interface Report {
  id: string;
  title: string;
  subjectPlayerId: string | null;
  subjectTeamId: string | null;
  reportDate: string;
  summary: string | null;
  strengths: string | null;
  weaknesses: string | null;
  overallRating: number | null;
  skillRatings: Record<string, number> | null;
  recommendation: string | null;
  visibility: string;
  shareToken: string | null;
  tags: string[] | null;
  isOpponentReport: boolean;
}

const SKILL_LABELS: [string, string][] = [
  ['scoring', 'Scoring'],
  ['ballHandling', 'Ball Handling'],
  ['passing', 'Passing'],
  ['offBallMovement', 'Off-Ball Movement'],
  ['defenseOnBall', 'Defense (On-Ball)'],
  ['defenseHelp', 'Defense (Help)'],
  ['rebounding', 'Rebounding'],
  ['athleticism', 'Athleticism'],
  ['basketballIq', 'Basketball IQ'],
  ['clutch', 'Clutch'],
];

const RECOMMENDATION_COLOR: Record<string, string> = {
  sign: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  monitor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  no_action: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

function SkillRatingInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-600 dark:text-gray-400 w-36 shrink-0">{label}</label>
      <input
        type="range" min={0} max={10} step={1}
        value={value === '' ? 0 : Number(value)}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 accent-brand-600"
      />
      <span className="text-xs font-bold text-brand-600 dark:text-brand-400 w-6 text-right">
        {value === '' ? '—' : value}
      </span>
    </div>
  );
}

const EMPTY_SKILLS = Object.fromEntries(SKILL_LABELS.map(([k]) => [k, '']));

export default function ScoutingPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [rating, setRating] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [isOpponent, setIsOpponent] = useState(false);
  const [skillInputs, setSkillInputs] = useState<Record<string, string>>(EMPTY_SKILLS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ['scouting-reports'],
    queryFn: () => api.get('/scouting-reports'),
  });

  const resetForm = () => {
    setTitle(''); setSummary(''); setStrengths(''); setWeaknesses('');
    setRating(''); setRecommendation(''); setIsOpponent(false);
    setSkillInputs(EMPTY_SKILLS);
  };

  const createMutation = useMutation({
    mutationFn: (data: object) => api.post('/scouting-reports', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scouting-reports'] });
      setShowCreate(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scouting-reports/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scouting-reports'] }),
  });

  const shareMutation = useMutation({
    mutationFn: ({ id, revoke }: { id: string; revoke: boolean }) =>
      api.post<{ shareToken: string | null }>(`/scouting-reports/${id}/share`, { revoke }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scouting-reports'] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const builtSkills = Object.fromEntries(
      SKILL_LABELS.map(([k]) => [k, skillInputs[k] !== '' ? Number(skillInputs[k]) : 0])
    );
    const hasAnySkill = Object.values(builtSkills).some((v) => v > 0);
    createMutation.mutate({
      title,
      summary: summary || undefined,
      strengths: strengths || undefined,
      weaknesses: weaknesses || undefined,
      overallRating: rating !== '' ? Number(rating) : undefined,
      skillRatings: hasAnySkill ? builtSkills : undefined,
      recommendation: recommendation || undefined,
      isOpponentReport: isOpponent,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Scouting Reports</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Report
        </button>
      </div>

      <AIScoutingAssist />

      {isLoading && <p className="text-gray-500">Loading…</p>}

      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card overflow-hidden">
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-gray-100 truncate">{r.title}</span>
                    {r.isOpponentReport && (
                      <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded-full">Opponent</span>
                    )}
                    {r.recommendation && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RECOMMENDATION_COLOR[r.recommendation] ?? ''}`}>
                        {r.recommendation.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{new Date(r.reportDate).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {r.overallRating !== null && (
                    <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{r.overallRating}/10</span>
                  )}
                  <span className="text-gray-300 dark:text-gray-600">{expandedId === r.id ? '▲' : '▼'}</span>
                </div>
              </div>
            </div>

            {expandedId === r.id && (
              <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                {r.summary && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Summary</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{r.summary}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {r.strengths && (
                    <div>
                      <p className="text-xs font-medium text-green-600 uppercase mb-1">Strengths</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{r.strengths}</p>
                    </div>
                  )}
                  {r.weaknesses && (
                    <div>
                      <p className="text-xs font-medium text-red-500 uppercase mb-1">Weaknesses</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{r.weaknesses}</p>
                    </div>
                  )}
                </div>

                {r.skillRatings && Object.values(r.skillRatings).some((v) => v > 0) && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-3">Skill Ratings</p>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="shrink-0">
                        <RadarChart
                          axes={SKILL_LABELS.map(([k, label]) => ({ label, value: r.skillRatings?.[k] ?? 0 }))}
                          size={200}
                        />
                      </div>
                      <div className="flex-1 grid grid-cols-1 gap-1 w-full">
                        {SKILL_LABELS.map(([k, label]) => {
                          const val = r.skillRatings?.[k] ?? 0;
                          return (
                            <div key={k} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
                              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                                <div
                                  className="bg-brand-600 h-1.5 rounded-full transition-all"
                                  style={{ width: `${val * 10}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-brand-600 dark:text-brand-400 w-4 text-right">{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {r.tags && r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {r.shareToken ? (
                    <>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/share/${r.shareToken}`;
                          navigator.clipboard.writeText(url);
                        }}
                        className="text-xs px-3 py-1.5 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 rounded-lg transition-colors"
                      >
                        Copy share link
                      </button>
                      <button
                        onClick={() => shareMutation.mutate({ id: r.id, revoke: true })}
                        className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Revoke link
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => shareMutation.mutate({ id: r.id, revoke: false })}
                      className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Generate share link
                    </button>
                  )}
                  <a
                    href={`/api/v1/export/scouting/${r.id}/pdf`}
                    download
                    className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Export PDF
                  </a>
                  <button
                    onClick={() => {
                      if (confirm('Delete this report?')) deleteMutation.mutate(r.id);
                    }}
                    className="text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 hover:bg-red-100 rounded-lg transition-colors ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {reports.length === 0 && !isLoading && (
          <p className="text-center text-gray-400 py-10">No reports yet. Write your first scouting report.</p>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-lg shadow-elevated my-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">New Scouting Report</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. John Doe — PG Scouting"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary</label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-green-600 mb-1">Strengths</label>
                  <textarea
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-red-500 mb-1">Weaknesses</label>
                  <textarea
                    value={weaknesses}
                    onChange={(e) => setWeaknesses(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Skill Ratings (0–10)</p>
                <div className="space-y-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  {SKILL_LABELS.map(([key, label]) => (
                    <SkillRatingInput
                      key={key}
                      label={label}
                      value={skillInputs[key]}
                      onChange={(v) => setSkillInputs((prev) => ({ ...prev, [key]: v }))}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rating (1–10)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recommendation</label>
                  <select
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">—</option>
                    <option value="sign">Sign</option>
                    <option value="monitor">Monitor</option>
                    <option value="pass">Pass</option>
                    <option value="no_action">No action</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input type="checkbox" checked={isOpponent} onChange={(e) => setIsOpponent(e.target.checked)} className="rounded" />
                Opponent report
              </label>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => { setShowCreate(false); resetForm(); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
                >
                  {createMutation.isPending ? 'Saving…' : 'Save Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
