// Shared SVG court geometry — renders inside an existing <svg>.
// Positions match classifyShotZone thresholds (basket at y=0.08,
// 3-point arc at y=0.44, paint at y=0.35, corners at x=0.18/0.82).

interface CourtLinesProps {
  W: number;
  H: number;
  stroke?: string;
  strokeWidth?: number;
}

// Derive the 3-point arc radius so the arc passes exactly through
// (0.18W, 0.22H), (0.5W, 0.44H), and (0.82W, 0.22H).
function threePointArcR(W: number, H: number): number {
  const a = 0.44 * H;  // arc bottom y
  const b = 0.22 * H;  // corner join y
  const cSq = (0.32 * W) ** 2;
  const centerY = (a * a - cSq - b * b) / (2 * (a - b));
  return Math.round(a - centerY);
}

export function CourtLines({ W, H, stroke = 'white', strokeWidth = 2 }: CourtLinesProps) {
  const sw = strokeWidth;
  const bx = 0.5 * W;
  const by = 0.08 * H;

  const paintL = 0.3 * W;
  const paintR = 0.7 * W;
  const paintBot = 0.35 * H;

  const ftR = 0.115 * W;
  const raR = 0.055 * H;

  const cornerX = 0.18 * W;
  const cornerY = 0.22 * H;
  const arcR = threePointArcR(W, H);

  // Lane tick mark y positions (three pairs, evenly spaced in the paint)
  const ticks = [0.13, 0.20, 0.27].map((f) => f * H);

  return (
    <>
      {/* Court boundary */}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke={stroke} strokeWidth={sw} opacity={0.5} />

      {/* Backboard */}
      <rect
        x={bx - 0.13 * W} y={0}
        width={0.26 * W} height={Math.max(4, H * 0.014)}
        fill="none" stroke={stroke} strokeWidth={sw} opacity={0.85}
      />

      {/* Basket (rim) */}
      <circle cx={bx} cy={by} r={W * 0.022} fill="none" stroke={stroke} strokeWidth={sw} />

      {/* Restricted area arc — sweeps away from baseline (sweep=0 = CCW in SVG) */}
      <path
        d={`M ${bx - raR} ${by} A ${raR} ${raR} 0 0 0 ${bx + raR} ${by}`}
        fill="none" stroke={stroke} strokeWidth={sw * 0.8} opacity={0.6}
      />

      {/* Paint */}
      <rect
        x={paintL} y={0}
        width={paintR - paintL} height={paintBot}
        fill="none" stroke={stroke} strokeWidth={sw} opacity={0.85}
      />

      {/* Lane tick marks */}
      {ticks.map((ty, i) => (
        <g key={i}>
          <line x1={paintL - 0.025 * W} y1={ty} x2={paintL} y2={ty} stroke={stroke} strokeWidth={sw * 0.75} opacity={0.65} />
          <line x1={paintR} y1={ty} x2={paintR + 0.025 * W} y2={ty} stroke={stroke} strokeWidth={sw * 0.75} opacity={0.65} />
        </g>
      ))}

      {/* Free throw line */}
      <line x1={paintL} y1={paintBot} x2={paintR} y2={paintBot} stroke={stroke} strokeWidth={sw} opacity={0.85} />

      {/* FT circle — upper half (dashed, inside paint, sweep=1 = CW = toward basket) */}
      <path
        d={`M ${bx - ftR} ${paintBot} A ${ftR} ${ftR} 0 0 1 ${bx + ftR} ${paintBot}`}
        fill="none" stroke={stroke} strokeWidth={sw}
        strokeDasharray={`${sw * 3} ${sw * 2}`} opacity={0.65}
      />

      {/* FT circle — lower half (solid, below paint, sweep=0 = CCW = away from basket) */}
      <path
        d={`M ${bx - ftR} ${paintBot} A ${ftR} ${ftR} 0 0 0 ${bx + ftR} ${paintBot}`}
        fill="none" stroke={stroke} strokeWidth={sw} opacity={0.85}
      />

      {/* 3-point line: corner straights */}
      <line x1={cornerX} y1={0} x2={cornerX} y2={cornerY} stroke={stroke} strokeWidth={sw} opacity={0.85} />
      <line x1={W - cornerX} y1={0} x2={W - cornerX} y2={cornerY} stroke={stroke} strokeWidth={sw} opacity={0.85} />

      {/* 3-point arc — sweep=0 (CCW in SVG) curves away from baseline through y=0.44H */}
      <path
        d={`M ${cornerX} ${cornerY} A ${arcR} ${arcR} 0 0 0 ${W - cornerX} ${cornerY}`}
        fill="none" stroke={stroke} strokeWidth={sw} opacity={0.85}
      />
    </>
  );
}
