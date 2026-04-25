import { useRef, useState } from 'react';
import { CourtLines } from './courtLines';

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

        <CourtLines W={W} H={H} />

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
