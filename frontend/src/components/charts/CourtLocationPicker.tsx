import { useRef, useState } from 'react';
import { CourtLines, isThreePointArea } from './courtLines';

export type ShotStatType = '2PM' | '2PA' | '3PM' | '3PA';

interface CourtLocationPickerProps {
  playerName: string;
  /** Called once MADE or MISS is chosen, with the tapped location and the derived stat type. */
  onConfirm: (x: number, y: number, statType: ShotStatType) => void;
  /** Fired when the user cancels by tapping outside the court/content area. */
  onCancel: () => void;
}

const W = 400;
const H = Math.round(W * 14 / 15);

export function CourtLocationPicker({ playerName, onConfirm, onCancel }: CourtLocationPickerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number; isThree: boolean } | null>(null);

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

  function handleResult(made: boolean) {
    if (!pending) return;
    const statType: ShotStatType = pending.isThree
      ? (made ? '3PM' : '3PA')
      : (made ? '2PM' : '2PA');
    onConfirm(pending.x, pending.y, statType);
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 gap-4" onClick={onCancel}>
      <div className="flex flex-col items-center gap-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-white text-center">
          <p className="text-sm text-gray-400 mb-0.5">{playerName}</p>
          <p className="text-base font-semibold">
            {pending ? 'Made or missed?' : 'Tap the shot location'}
          </p>
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full rounded-lg touch-none cursor-crosshair"
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

          {/* Selected shot location */}
          {pending && (
            <circle cx={pending.x * W} cy={pending.y * H} r={9} fill="#3b82f6" />
          )}

          {/* Hover preview dot */}
          {!pending && hover && (
            <circle cx={hover.x * W} cy={hover.y * H} r={9} fill="#3b82f6" opacity={0.6} />
          )}
        </svg>

        {/* Auto-classification banner */}
        {pending && (
          <div
            data-testid="shot-classification-banner"
            role="status"
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-white ${
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

        {pending && (
          <div className="flex gap-3 w-full">
            <button
              onClick={() => handleResult(false)}
              className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-sm font-semibold text-white"
            >
              MISS
            </button>
            <button
              onClick={() => handleResult(true)}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 rounded-xl text-sm font-semibold text-white"
            >
              MADE
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
