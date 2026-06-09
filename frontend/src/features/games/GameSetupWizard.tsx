import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface GameSetupWizardProps {
  teamId: string;
  teamName?: string;
  onClose: () => void;
}

interface GameTemplate {
  id: string;
  name: string;
  format: 'quarters' | 'halves';
  numPeriods: number;
  periodDurationMinutes: number;
  overtimeEnabled: boolean;
  overtimeDurationMinutes: number;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber?: number | null;
  position?: string | null;
  status: string;
}

type Format = 'quarters' | 'halves';

export default function GameSetupWizard({ teamId, teamName, onClose }: GameSetupWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 — Teams
  const [awayTeamName, setAwayTeamName] = useState('');
  const [date, setDate] = useState('');

  // Step 2 — Format
  const [format, setFormat] = useState<Format>('quarters');
  const [periodDuration, setPeriodDuration] = useState<10 | 12 | 'custom'>(10);
  const [customDuration, setCustomDuration] = useState(10);
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [overtimeDuration, setOvertimeDuration] = useState(5);

  // Step 3 — Starting Lineups
  const [homeStarters, setHomeStarters] = useState<string[]>([]);

  // Step 4 — Template
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const numPeriods = format === 'halves' ? 2 : 4;
  const resolvedDuration = periodDuration === 'custom' ? customDuration : periodDuration;

  const { data: templates = [] } = useQuery<GameTemplate[]>({
    queryKey: ['game-templates'],
    queryFn: () => api.get('/game-templates'),
    // Silently ignore if endpoint doesn't exist yet
    retry: false,
  });

  const { data: homePlayers = [] } = useQuery<Player[]>({
    queryKey: ['players', teamId],
    queryFn: () => api.get(`/teams/${teamId}/players`),
  });

  const createMutation = useMutation({
    mutationFn: async (templateSave: boolean) => {
      const gameData = {
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        format,
        numPeriods,
        periodDurationMinutes: resolvedDuration,
        notes: awayTeamName || undefined,
      };

      const game = await api.post<{ id: string }>(`/teams/${teamId}/games`, gameData);

      if (homeStarters.length > 0) {
        await api.post(`/games/${game.id}/lineups/initial`, {
          teamId,
          playerIds: homeStarters,
        }).catch(() => undefined); // silently ignore if endpoint not ready
      }

      if (templateSave && templateName) {
        // Save as template — silently ignore errors if endpoint not ready
        await api.post('/game-templates', {
          name: templateName,
          format,
          numPeriods,
          periodDurationMinutes: resolvedDuration,
          overtimeEnabled,
          overtimeDurationMinutes: overtimeDuration,
        }).catch(() => undefined);
      }

      return game;
    },
    onSuccess: (game) => {
      navigate(`/games/${game.id}/live`);
    },
  });

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setFormat(tpl.format);
    setPeriodDuration(
      tpl.periodDurationMinutes === 10 ? 10
        : tpl.periodDurationMinutes === 12 ? 12
        : 'custom'
    );
    if (tpl.periodDurationMinutes !== 10 && tpl.periodDurationMinutes !== 12) {
      setCustomDuration(tpl.periodDurationMinutes);
    }
    setOvertimeEnabled(tpl.overtimeEnabled);
    setOvertimeDuration(tpl.overtimeDurationMinutes);
  }

  const formatLabel = format === 'halves' ? '2 Halves (HS)' : '4 Quarters (FIBA/NCAA)';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-elevated flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Game</h2>
          <span className="text-sm text-gray-400">Step {step} of 4</span>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 px-6 pt-3 pb-0 shrink-0">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full transition-colors ${
                s <= step ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">

          {/* Step 1 — Teams */}
          {step === 1 && (
            <>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs">Teams</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Home Team
                </label>
                <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 select-none">
                  {teamName ?? 'Your Team'}
                </div>
                <p className="text-xs text-gray-400 mt-1">Home team is set by your roster.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Opponent / Away Team
                </label>
                <input
                  type="text"
                  value={awayTeamName}
                  onChange={(e) => setAwayTeamName(e.target.value)}
                  placeholder="Opponent team name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </>
          )}

          {/* Step 2 — Format */}
          {step === 2 && (
            <>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs">Game Format</p>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Format</p>
                <div className="space-y-2">
                  {([
                    { value: 'quarters', label: '4 Quarters (FIBA/NCAA)' },
                    { value: 'halves', label: '2 Halves (HS)' },
                  ] as const).map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="format"
                        value={opt.value}
                        checked={format === opt.value}
                        onChange={() => setFormat(opt.value)}
                        className="accent-brand-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Period Duration</p>
                <div className="space-y-2">
                  {([
                    { value: 10, label: '10 min' },
                    { value: 12, label: '12 min' },
                    { value: 'custom', label: 'Custom' },
                  ] as const).map((opt) => (
                    <label key={String(opt.value)} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="periodDuration"
                        value={String(opt.value)}
                        checked={periodDuration === opt.value}
                        onChange={() => setPeriodDuration(opt.value)}
                        className="accent-brand-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                    </label>
                  ))}
                </div>
                {periodDuration === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={customDuration}
                      onChange={(e) => setCustomDuration(Number(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-500">minutes</span>
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overtimeEnabled}
                    onChange={(e) => setOvertimeEnabled(e.target.checked)}
                    className="accent-brand-600 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable overtime</span>
                </label>
                {overtimeEnabled && (
                  <div className="mt-2 flex items-center gap-2 ml-7">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={overtimeDuration}
                      onChange={(e) => setOvertimeDuration(Number(e.target.value))}
                      className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-500">min per OT</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 3 — Starting Lineups */}
          {step === 3 && (
            <>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs">Starting Lineup — Home Team</p>
              {(() => {
                const activePlayers = homePlayers.filter((p) => p.status === 'active');
                if (activePlayers.length === 0) {
                  return (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                      No active players — lineups can be set from the Live Recording page.
                    </p>
                  );
                }
                return (
                  <>
                    <div className="space-y-2">
                      {activePlayers.map((player) => {
                        const selected = homeStarters.includes(player.id);
                        return (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => {
                              if (selected) {
                                setHomeStarters((prev) => prev.filter((id) => id !== player.id));
                              } else if (homeStarters.length < 5) {
                                setHomeStarters((prev) => [...prev, player.id]);
                              }
                            }}
                            className={`w-full rounded-lg px-3 py-2 cursor-pointer text-sm flex items-center gap-2 text-left transition-colors ${
                              selected
                                ? 'ring-2 ring-brand-500 bg-brand-50 dark:bg-brand-900/20 text-gray-900 dark:text-gray-100'
                                : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <span className="w-7 text-center font-mono text-xs text-gray-400 dark:text-gray-500 shrink-0">
                              {player.jerseyNumber != null ? `#${player.jerseyNumber}` : '—'}
                            </span>
                            <span className="font-medium">{player.firstName} {player.lastName}</span>
                            {player.position && (
                              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{player.position}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center pt-1">
                      {homeStarters.length} of 5 starters selected
                    </p>
                  </>
                );
              })()}
            </>
          )}

          {/* Step 4 — Confirm & Create */}
          {step === 4 && (
            <>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs">Confirm &amp; Create</p>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {date ? new Date(date).toLocaleString() : 'Now'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Opponent</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {awayTeamName || '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Format</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{formatLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Period duration</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{resolvedDuration} min</span>
                </div>
                {overtimeEnabled && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">OT duration</span>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">{overtimeDuration} min</span>
                  </div>
                )}
              </div>

              {/* Template section */}
              <div className="space-y-3">
                {templates.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Load template
                    </label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => {
                        setSelectedTemplateId(e.target.value);
                        if (e.target.value) applyTemplate(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">— select a template —</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                    className="accent-brand-600 w-4 h-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Save as template</span>
                </label>
                {saveAsTemplate && (
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name (e.g. FIBA 10min)"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                )}
              </div>

              {createMutation.isError && (
                <p className="text-sm text-red-500">Failed to create game. Please try again.</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <div>
            {step === 1 ? (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 4 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Next
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => createMutation.mutate(saveAsTemplate)}
                  disabled={createMutation.isPending}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Game'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
