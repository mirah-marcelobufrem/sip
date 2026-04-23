import { useMemo } from 'react';

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
  showZones?: boolean;
}

const COURT_RATIO = 0.53;

export function ShotChart({ shots, width = 400, height = 400 * 0.53, showZones = false }: ShotChartProps) {
  const w = width;
  const h = height;

  const dots = useMemo(
    () =>
      shots
        .filter((s) => s.x !== null && s.y !== null)
        .map((s, i) => ({
          id: i,
          cx: s.x * w,
          cy: s.y * h,
          made: s.made,
          color: s.made ? '#16a34a' : '#ef4444',
        })),
    [shots, w, h],
  );

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="rounded-lg overflow-hidden">
      {/* Court background */}
      <rect width={w} height={h} fill="#c8a96e" rx={8} />

      {/* Paint */}
      <rect x={w * 0.3} y={0} width={w * 0.4} height={h * 0.62} fill="none" stroke="white" strokeWidth={2} opacity={0.6} />

      {/* Free throw line */}
      <line x1={w * 0.3} y1={h * 0.62} x2={w * 0.7} y2={h * 0.62} stroke="white" strokeWidth={2} opacity={0.6} />

      {/* Basket */}
      <circle cx={w * 0.5} cy={h * 0.08} r={w * 0.02} fill="none" stroke="white" strokeWidth={2} />

      {/* 3-point arc */}
      <path
        d={`M ${w * 0.06} ${h * 0.18} A ${w * 0.44} ${w * 0.44} 0 0 1 ${w * 0.94} ${h * 0.18}`}
        fill="none"
        stroke="white"
        strokeWidth={2}
        opacity={0.6}
      />

      {/* Corner 3 lines */}
      <line x1={w * 0.06} y1={0} x2={w * 0.06} y2={h * 0.18} stroke="white" strokeWidth={2} opacity={0.6} />
      <line x1={w * 0.94} y1={0} x2={w * 0.94} y2={h * 0.18} stroke="white" strokeWidth={2} opacity={0.6} />

      {/* Shot dots */}
      {dots.map((dot) => (
        dot.made ? (
          <circle key={dot.id} cx={dot.cx} cy={dot.cy} r={6} fill={dot.color} opacity={0.85} />
        ) : (
          <circle key={dot.id} cx={dot.cx} cy={dot.cy} r={6} fill="none" stroke={dot.color} strokeWidth={2} opacity={0.85} />
        )
      ))}
    </svg>
  );
}
