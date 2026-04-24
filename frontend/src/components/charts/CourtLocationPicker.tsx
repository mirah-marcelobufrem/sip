import { useRef, useState } from 'react';

export type ShotStatType = '2PM' | '2PA' | '3PM' | '3PA';

interface CourtLocationPickerProps {
  statType: ShotStatType;
  playerName: string;
  onConfirm: (x: number, y: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}

const W = 400;
const H = Math.round(W * 0.65);

// Compute 3-point arc radius so the arc passes through
// (0.18*W, 0.22*H), (0.5*W, 0.44*H), (0.82*W, 0.22*H) —
// matching classifyShotZone thresholds.
function computeArcR(w: number, h: number): number {
  const a = 0.44 * h;
  const b = 0.22 * h;
  const cSq = (0.32 * w) ** 2;
  const arcCy = (a * a - cSq - b * b) / (2 * (a - b));
  return Math.round(a - arcCy);
}

const ARC_R = computeArcR(W, H);

export function CourtLocationPicker({ statType, playerName, onConfirm, onSkip, onCancel }: CourtLocationPickerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const made = statType === '2PM' || statType === '3PM';
  const dotColor = made ? '#16a34a' : '#ef4444';

  function toNorm(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 gap-4">
      <div className="text-white text-center">
        <p className="text-sm text-gray-400 mb-0.5">{statType} — {playerName}</p>
        <p className="text-base font-semibold">Tap the shot location</p>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-sm rounded-lg touch-none cursor-crosshair"
        onMouseMove={(e) => {
          const c = toNorm(e.clientX, e.clientY);
          if (c) setHover(c);
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const c = toNorm(e.clientX, e.clientY);
          if (c) onConfirm(c.x, c.y);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          const t = e.changedTouches[0];
          const c = toNorm(t.clientX, t.clientY);
          if (c) onConfirm(c.x, c.y);
        }}
      >
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

        {/* 3-point line: corner straights + arc (sweep=0 = CCW in SVG = curves away from baseline) */}
        <line x1={W * 0.18} y1={0} x2={W * 0.18} y2={H * 0.22} stroke="white" strokeWidth={2} opacity={0.7} />
        <line x1={W * 0.82} y1={0} x2={W * 0.82} y2={H * 0.22} stroke="white" strokeWidth={2} opacity={0.7} />
        <path
          d={`M ${W * 0.18} ${H * 0.22} A ${ARC_R} ${ARC_R} 0 0 0 ${W * 0.82} ${H * 0.22}`}
          fill="none"
          stroke="white"
          strokeWidth={2}
          opacity={0.7}
        />

        {/* Hover preview dot */}
        {hover && (
          made ? (
            <circle cx={hover.x * W} cy={hover.y * H} r={9} fill={dotColor} opacity={0.8} />
          ) : (
            <circle cx={hover.x * W} cy={hover.y * H} r={9} fill="none" stroke={dotColor} strokeWidth={2.5} opacity={0.8} />
          )
        )}
      </svg>

      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onSkip}
          className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm text-gray-400 font-medium"
        >
          Skip location
        </button>
      </div>
    </div>
  );
}
