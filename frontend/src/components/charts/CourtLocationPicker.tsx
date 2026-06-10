import { useRef, useState } from 'react';
import { CourtLines, isThreePointArea } from './courtLines';

export type ShotStatType = '2PM' | '2PA' | '3PM' | '3PA';

interface CourtLocationPickerProps {
  /** Provisional stat type from the stat button — only made/missed is kept;
   *  2pt vs 3pt is auto-derived from the tapped location. */
  statType: ShotStatType;
  playerName: string;
  /** Called on confirm with the tapped location and the derived stat type. */
  onConfirm: (x: number, y: number, statType: ShotStatType) => void;
  onSkip: () => void;
  onCancel: () => void;
}

const W = 400;
const H = Math.round(W * 14 / 15);

export function CourtLocationPicker({ statType, playerName, onConfirm, onSkip, onCancel }: CourtLocationPickerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number; isThree: boolean } | null>(null);
  const made = statType === '2PM' || statType === '3PM';
  const dotColor = made ? '#16a34a' : '#ef4444';

  const derivedType: ShotStatType | null = pending
    ? pending.isThree
      ? (made ? '3PM' : '3PA')
      : (made ? '2PM' : '2PA')
    : null;

  function toNorm(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    };
  }

  function handleTap(clientX: number, clientY: number) {
    const c = toNorm(clientX, clientY);
    if (!c) return;
    // The rendered court has the basket at the top (y ≈ 0.113); the
    // classification frame has it at (0.5, 0.885) — mirror y before classifying.
    setPending({ ...c, isThree: isThreePointArea(c.x, 1 - c.y) });
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 gap-4">
      <div className="text-white text-center">
        <p className="text-sm text-gray-400 mb-0.5">{made ? 'Made shot' : 'Missed shot'} — {playerName}</p>
        <p className="text-base font-semibold">
          {pending ? 'Confirm the shot, or tap again to move it' : 'Tap the shot location'}
        </p>
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
        onClick={(e) => handleTap(e.clientX, e.clientY)}
        onTouchEnd={(e) => {
          e.preventDefault();
          const t = e.changedTouches[0];
          handleTap(t.clientX, t.clientY);
        }}
      >
        {/* Court background */}
        <rect width={W} height={H} fill="#c8a96e" rx={8} />

        <CourtLines W={W} H={H} />

        {/* Selected shot dot */}
        {pending && (
          made ? (
            <circle cx={pending.x * W} cy={pending.y * H} r={9} fill={dotColor} />
          ) : (
            <circle cx={pending.x * W} cy={pending.y * H} r={9} fill="none" stroke={dotColor} strokeWidth={2.5} />
          )
        )}

        {/* Hover preview dot */}
        {!pending && hover && (
          made ? (
            <circle cx={hover.x * W} cy={hover.y * H} r={9} fill={dotColor} opacity={0.8} />
          ) : (
            <circle cx={hover.x * W} cy={hover.y * H} r={9} fill="none" stroke={dotColor} strokeWidth={2.5} opacity={0.8} />
          )
        )}
      </svg>

      {/* Auto-classification banner */}
      {pending && (
        <div
          data-testid="shot-classification-banner"
          role="status"
          className={`w-full max-w-sm flex items-center justify-between px-4 py-2.5 rounded-xl text-white ${
            pending.isThree ? 'bg-blue-600' : 'bg-gray-600'
          }`}
        >
          <span className="text-sm font-bold tracking-wide">
            {pending.isThree ? '3-POINT SHOT' : '2-POINT SHOT'}
          </span>
          <button
            onClick={() => setPending((p) => (p ? { ...p, isThree: !p.isThree } : p))}
            className="text-xs font-medium underline underline-offset-2 opacity-90 hover:opacity-100"
          >
            Override
          </button>
        </div>
      )}

      <div className="flex gap-3 w-full max-w-sm">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 font-medium"
        >
          Cancel
        </button>
        {pending && derivedType ? (
          <button
            onClick={() => onConfirm(pending.x, pending.y, derivedType)}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-semibold text-white"
          >
            Confirm {derivedType}
          </button>
        ) : (
          <button
            onClick={onSkip}
            className="flex-1 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm text-gray-400 font-medium"
          >
            Skip location
          </button>
        )}
      </div>
    </div>
  );
}
