import { useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { useThemeStore } from '../../store/theme.store';
import { usePushNotifications } from '../../hooks/usePushNotifications';

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="ml-4 flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-20 text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
    />
  );
}

const PUSH_BUTTON_LABELS: Record<string, string> = {
  unsupported: 'Not supported',
  denied: 'Blocked by browser',
  granted: 'Enabled',
  prompt: 'Enable notifications',
  subscribing: 'Enabling…',
};

export default function SettingsPage() {
  const { data: prefs, isLoading } = useSettings();
  const { mutate: updateSettings } = useUpdateSettings();
  const { theme, setTheme } = useThemeStore();
  const { status: pushStatus, subscribe, unsubscribe } = usePushNotifications();

  useEffect(() => {
    if (prefs?.theme && prefs.theme !== theme) {
      setTheme(prefs.theme);
    }
  }, [prefs?.theme]);

  function patch(partial: Parameters<typeof updateSettings>[0]) {
    updateSettings(partial);
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">Loading settings…</div>
    );
  }

  const p = prefs ?? {};

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>

      {/* General */}
      <section>
        <SectionHeader title="General" description="App-wide display and behavior preferences" />
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4">
          <SettingRow label="Language">
            <Select
              value={p.language ?? 'en'}
              onChange={(v) => patch({ language: v })}
              options={[{ value: 'en', label: 'English' }, { value: 'pt', label: 'Português' }]}
            />
          </SettingRow>
          <SettingRow label="Units">
            <Select
              value={p.units ?? 'metric'}
              onChange={(v) => patch({ units: v })}
              options={[{ value: 'metric', label: 'Metric (cm/kg)' }, { value: 'imperial', label: 'Imperial (ft/lbs)' }]}
            />
          </SettingRow>
          <SettingRow label="Default game format">
            <Select
              value={p.defaultGameFormat ?? 'quarters'}
              onChange={(v) => patch({ defaultGameFormat: v })}
              options={[{ value: 'quarters', label: 'Quarters' }, { value: 'halves', label: 'Halves' }]}
            />
          </SettingRow>
          <SettingRow label="Default period duration" description="Minutes per period">
            <NumberInput value={p.defaultPeriodDuration ?? 10} min={5} max={60} onChange={(v) => patch({ defaultPeriodDuration: v })} />
          </SettingRow>
          <SettingRow label="Default foul limit" description="Fouls before bonus">
            <NumberInput value={p.defaultFoulLimit ?? 5} min={1} max={10} onChange={(v) => patch({ defaultFoulLimit: v })} />
          </SettingRow>
          <SettingRow label="Player sort order">
            <Select
              value={p.playerSortOrder ?? 'jersey'}
              onChange={(v) => patch({ playerSortOrder: v })}
              options={[{ value: 'jersey', label: 'Jersey number' }, { value: 'lastName', label: 'Last name' }]}
            />
          </SettingRow>
          <SettingRow label="Show advanced stats" description="eFG%, TS%, PER, USG% in box scores">
            <Toggle checked={p.showAdvancedStats ?? false} onChange={(v) => patch({ showAdvancedStats: v })} />
          </SettingRow>
        </div>
      </section>

      {/* Appearance */}
      <section>
        <SectionHeader title="Appearance" />
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4">
          <SettingRow label="Theme">
            <Select
              value={theme}
              onChange={(v) => {
                setTheme(v);
                patch({ theme: v });
              }}
              options={[
                { value: 'system', label: 'System default' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </SettingRow>
        </div>
      </section>

      {/* Game recording */}
      <section>
        <SectionHeader title="Game Recording" description="Controls live stat entry behavior" />
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4">
          <SettingRow label="Shot chart prompt" description="When to ask for shot location">
            <Select
              value={p.shotChartPrompt ?? 'timed'}
              onChange={(v) => patch({ shotChartPrompt: v })}
              options={[
                { value: 'always', label: 'Always' },
                { value: 'timed', label: 'For 10 seconds' },
                { value: 'never', label: 'Never' },
              ]}
            />
          </SettingRow>
          <SettingRow label="Opponent tracking" description="How to track opponent stats">
            <Select
              value={p.opponentTrackingMode ?? 'individual'}
              onChange={(v) => patch({ opponentTrackingMode: v })}
              options={[
                { value: 'individual', label: 'Individual players' },
                { value: 'team', label: 'Team totals' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </SettingRow>
          <SettingRow label="Simplified mode" description="Track only points and fouls">
            <Toggle checked={p.simplifiedMode ?? false} onChange={(v) => patch({ simplifiedMode: v })} />
          </SettingRow>
          <SettingRow label="Foul trouble threshold" description="Alert when player reaches this many fouls">
            <NumberInput value={p.foulTroubleThreshold ?? 3} min={1} max={6} onChange={(v) => patch({ foulTroubleThreshold: v })} />
          </SettingRow>
          <SettingRow label="Scoring run alert" description="Alert when opponent scores this many unanswered">
            <NumberInput value={p.scoringRunAlertThreshold ?? 7} min={3} max={20} onChange={(v) => patch({ scoringRunAlertThreshold: v })} />
          </SettingRow>
        </div>
      </section>

      {/* Notifications */}
      <section>
        <SectionHeader title="Notifications" />
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 px-4">
          <SettingRow label="Push notifications" description="Receive alerts on this device">
            {pushStatus === 'granted' ? (
              <button onClick={unsubscribe} className="text-sm text-red-600 dark:text-red-400 font-medium hover:underline">
                Disable
              </button>
            ) : (
              <button
                onClick={subscribe}
                disabled={pushStatus === 'unsupported' || pushStatus === 'denied' || pushStatus === 'subscribing'}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {PUSH_BUTTON_LABELS[pushStatus]}
              </button>
            )}
          </SettingRow>
          {(['gameRecapReady', 'developmentMilestone', 'reportShared', 'invitation'] as const).map((key) => (
            <SettingRow key={key} label={
              key === 'gameRecapReady' ? 'Game recap ready' :
              key === 'developmentMilestone' ? 'Development milestone reached' :
              key === 'reportShared' ? 'Scouting report shared with you' :
              'Team invitation'
            }>
              <Toggle
                checked={p.notificationsEnabled?.[key] ?? true}
                onChange={(v) => patch({ notificationsEnabled: { ...p.notificationsEnabled, [key]: v } })}
              />
            </SettingRow>
          ))}
        </div>
      </section>
    </div>
  );
}
