import { useMemo } from 'react';
import { CourtLines } from './courtLines';

interface Shot {
  x: number;
  y: number;
  made: boolean;
  type: '2PM' | '2PA' | '3PM' | '3PA';
}

interface ShotChartProps {
  shots: Shot[];
  width?: number;
  height?: number;
  mode?: 'dots' | 'heat';
}

export function ShotChart({ shots, width = 400, height = Math.round(400 * 14 / 15), mode = 'dots' }: ShotChartProps) {
  const W = width;
  const H = height;

  const dots = useMemo(
    () =>
      shots
        .filter((s) => s.x != null && s.y != null)
        .map((s, i) => ({
          id: i,
          cx: s.x * W,
          cy: s.y * H,
          made: s.made,
          color: s.made ? '#16a34a' : '#ef4444',
        })),
    [shots, W, H],
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="rounded-lg overflow-hidden">
      {mode === 'heat' && (
        <defs>
          <filter id="sc-heat" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="11" />
          </filter>
        </defs>
      )}

      {/* Court background */}
      <rect width={W} height={H} fill="#c8a96e" rx={8} />

      <CourtLines W={W} H={H} />

      {/* Shot dots or heat blobs */}
      {mode === 'heat'
        ? dots.map((dot) => (
            <circle
              key={dot.id}
              cx={dot.cx}
              cy={dot.cy}
              r={22}
              fill={dot.color}
              opacity={0.35}
              filter="url(#sc-heat)"
            />
          ))
        : dots.map((dot) =>
            dot.made ? (
              <circle key={dot.id} cx={dot.cx} cy={dot.cy} r={6} fill={dot.color} opacity={0.85} />
            ) : (
              <circle key={dot.id} cx={dot.cx} cy={dot.cy} r={6} fill="none" stroke={dot.color} strokeWidth={2} opacity={0.85} />
            ),
          )}
    </svg>
  );
}
