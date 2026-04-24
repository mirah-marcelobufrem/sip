import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, TooltipProps,
} from 'recharts';

interface FlowPoint {
  period: number;
  clockTimeSeconds: number | null;
  homeScore: number;
  awayScore: number;
  differential: number;
}

interface ScoringRun {
  teamId: string;
  points: number;
  startPeriod: number;
  endPeriod: number;
}

interface GameFlowChartProps {
  flowPoints: FlowPoint[];
  scoringRuns?: ScoringRun[];
  homeLabel?: string;
  awayLabel?: string;
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as FlowPoint;
  const diff = d.differential;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-xs shadow-lg">
      <p className="font-semibold text-gray-700 dark:text-gray-300">Q{d.period}</p>
      <p className="text-gray-500">{d.homeScore} – {d.awayScore}</p>
      <p className={diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-gray-400'}>
        {diff > 0 ? `+${diff}` : diff} differential
      </p>
    </div>
  );
}

export function GameFlowChart({ flowPoints, scoringRuns = [], homeLabel = 'Home', awayLabel = 'Away' }: GameFlowChartProps) {
  if (flowPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No game flow data yet
      </div>
    );
  }

  const data = flowPoints.map((p, i) => ({ ...p, index: i }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="index" hide />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#9ca3af" strokeWidth={1.5} />
          <Line
            type="monotone"
            dataKey="differential"
            stroke="#1a56db"
            strokeWidth={2}
            dot={false}
            name="Differential"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 justify-center">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-brand-600" />
          Score differential ({homeLabel} − {awayLabel})
        </span>
        <span className="text-green-600">↑ {homeLabel} leading</span>
        <span className="text-red-500">↓ {awayLabel} leading</span>
      </div>

      {scoringRuns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {scoringRuns.slice(0, 4).map((run, i) => (
            <span key={i} className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
              {run.points}-0 run · Q{run.startPeriod}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
