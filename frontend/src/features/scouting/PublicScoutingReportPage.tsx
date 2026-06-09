import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RadarChart } from '../../components/charts/RadarChart';

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

interface PublicReport {
  id: string;
  title: string;
  reportDate: string;
  summary: string | null;
  strengths: string | null;
  weaknesses: string | null;
  overallRating: number | null;
  skillRatings: Record<string, number> | null;
  recommendation: string | null;
  tags: string[] | null;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'ok'; report: PublicReport }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

export default function PublicScoutingReportPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ status: 'not_found' });
      return;
    }

    fetch(`/api/v1/scouting-reports/share/${token}`)
      .then(async (res) => {
        if (res.status === 404) {
          setState({ status: 'not_found' });
          return;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => 'Unknown error');
          setState({ status: 'error', message: text });
          return;
        }
        const data: PublicReport = await res.json();
        setState({ status: 'ok', report: data });
      })
      .catch((err: unknown) => {
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Network error' });
      });
  }, [token]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Loading report…</p>
      </div>
    );
  }

  if (state.status === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">Report not available</p>
          <p className="text-gray-500 text-sm">This report has been removed or the link has expired.</p>
          <button
            onClick={() => window.history.back()}
            className="mt-6 text-sm text-brand-600 dark:text-brand-400 hover:underline"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-gray-500 text-sm">Something went wrong loading this report.</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 text-sm text-brand-600 dark:text-brand-400 hover:underline"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  const { report } = state;
  const hasSkillRatings =
    report.skillRatings !== null && Object.values(report.skillRatings).some((v) => v > 0);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ← Back
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Scouting Report</span>
        </div>

        {/* Title card */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.title}</h1>
              <p className="text-sm text-gray-400 mt-1">{new Date(report.reportDate).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {report.overallRating !== null && (
                <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                  {report.overallRating}<span className="text-base font-normal text-gray-400">/10</span>
                </span>
              )}
              {report.recommendation && (
                <span
                  className={`text-sm px-3 py-1 rounded-full font-medium ${RECOMMENDATION_COLOR[report.recommendation] ?? ''}`}
                >
                  {report.recommendation.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>

          {report.tags && report.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {report.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        {report.summary && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-5">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Summary</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {report.summary}
            </p>
          </div>
        )}

        {/* Strengths + Weaknesses */}
        {(report.strengths || report.weaknesses) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.strengths && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-5">
                <p className="text-xs font-medium text-green-600 uppercase mb-2">Strengths</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                  {report.strengths}
                </p>
              </div>
            )}
            {report.weaknesses && (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-5">
                <p className="text-xs font-medium text-red-500 uppercase mb-2">Weaknesses</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
                  {report.weaknesses}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Skill Ratings */}
        {hasSkillRatings && report.skillRatings && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-card p-5">
            <p className="text-xs font-medium text-gray-500 uppercase mb-4">Skill Ratings</p>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="shrink-0">
                <RadarChart
                  axes={SKILL_LABELS.map(([k, label]) => ({
                    label,
                    value: report.skillRatings?.[k] ?? 0,
                  }))}
                  size={220}
                />
              </div>
              <div className="flex-1 w-full space-y-1.5">
                {SKILL_LABELS.map(([k, label]) => {
                  const val = report.skillRatings?.[k] ?? 0;
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                        <div
                          className="bg-brand-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${val * 10}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400 w-4 text-right">
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
