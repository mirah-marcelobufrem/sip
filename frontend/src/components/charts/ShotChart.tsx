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
  mode?: 'dots' | 'heat';
}

// Compute the 3-point arc radius so the arc passes through
// (0.18*W, 0.22*H), (0.5*W, 0.44*H), and (0.82*W, 0.22*H).
// These match the classifyShotZone thresholds.
function computeArcR(W: number, H: number): number {
  const a = 0.44 * H;
  const b = 0.22 * H;
  const cSq = (0.32 * W) ** 2;
  const arcCy = (a * a - cSq - b * b) / (2 * (a - b));
  return Math.round(a - arcCy);
}

export function ShotChart({ shots, width = 400, height = Math.round(400 * 0.53), mode = 'dots' }: ShotChartProps) {
  const W = width;
  const H = height;
  const arcR = computeArcR(W, H);

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

      {/* Paint */}
      <rect x={W * 0.3} y={0} width={W * 0.4} height={H * 0.35} fill="none" stroke="white" strokeWidth={2} opacity={0.6} />

      {/* Free throw line */}
      <line x1={W * 0.3} y1={H * 0.35} x2={W * 0.7} y2={H * 0.35} stroke="white" strokeWidth={2} opacity={0.6} />

      {/* Basket */}
      <circle cx={W * 0.5} cy={H * 0.08} r={W * 0.02} fill="none" stroke="white" strokeWidth={2} />

      {/* Restricted area */}
      <ellipse cx={W * 0.5} cy={H * 0.08} rx={W * 0.055} ry={H * 0.055} fill="none" stroke="white" strokeWidth={1.5} opacity={0.5} />

      {/* 3-point line: corner straights + arc (sweep=0 = CCW in SVG = curves downward away from baseline) */}
      <line x1={W * 0.18} y1={0} x2={W * 0.18} y2={H * 0.22} stroke="white" strokeWidth={2} opacity={0.7} />
      <line x1={W * 0.82} y1={0} x2={W * 0.82} y2={H * 0.22} stroke="white" strokeWidth={2} opacity={0.7} />
      <path
        d={`M ${W * 0.18} ${H * 0.22} A ${arcR} ${arcR} 0 0 0 ${W * 0.82} ${H * 0.22}`}
        fill="none"
        stroke="white"
        strokeWidth={2}
        opacity={0.7}
      />

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
