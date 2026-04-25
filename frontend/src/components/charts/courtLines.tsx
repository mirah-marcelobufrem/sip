// Shared SVG court geometry — renders inside an existing <svg>.
// FIBA half-court: 15 m wide × 14 m deep.
// Normalized: x ∈ [0,1] over 15 m, y ∈ [0,1] over 14 m.
// Designed for H = W * 14/15 so all arcs render as true circles (rx = ry).

interface CourtLinesProps {
  W: number;
  H: number;
  stroke?: string;
  strokeWidth?: number;
}

export function CourtLines({ W, H, stroke = 'white', strokeWidth = 2 }: CourtLinesProps) {
  const sw = strokeWidth;

  // Basket: FIBA 1.575 m from baseline, centered
  const bx = 0.5 * W;
  const by = 0.113 * H;

  // Paint (key): 4.9 m wide (±2.45 m from center), 5.8 m deep
  const paintL = 0.337 * W;
  const paintR = 0.663 * W;
  const paintBot = 0.414 * H;

  // Arc radii in SVG units — equal rx/ry gives true circles when H = W*14/15
  const ftR  = 0.12 * W;     // FT circle: 1.8 m / 15 m
  const raR  = 0.0833 * W;   // Restricted area: 1.25 m / 15 m
  const arcR = 0.45 * W;     // 3-point arc: 6.75 m / 15 m

  // 3-point corner straights: 0.9 m from sideline, join arc at y ≈ 0.213
  const cornerX = 0.06 * W;
  const cornerY = 0.213 * H;

  // Backboard: 1.83 m wide, 0.9 m from baseline
  const bbHalf = 0.061 * W;  // 0.915 m / 15 m
  const bbY    = 0.064 * H;  // 0.9 m / 14 m

  // Lane hash marks (FIBA: 1.8 m, 3.0 m, 4.2 m from baseline)
  const ticks = [0.129, 0.214, 0.300].map((f) => f * H);
  const tickOut = 0.018 * W; // tick protrudes 0.27 m outward

  return (
    <>
      {/* Court boundary */}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke={stroke} strokeWidth={sw} opacity={0.5} />

      {/* Backboard */}
      <rect
        x={bx - bbHalf} y={0}
        width={bbHalf * 2} height={Math.max(4, H * 0.012)}
        fill="none" stroke={stroke} strokeWidth={sw} opacity={0.85}
      />

      {/* Basket (rim) */}
      <circle cx={bx} cy={by} r={W * 0.02} fill="none" stroke={stroke} strokeWidth={sw} />

      {/* Restricted area arc — sweeps away from baseline (CCW in SVG = sweep=0) */}
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

      {/* Lane hash marks */}
      {ticks.map((ty, i) => (
        <g key={i}>
          <line x1={paintL - tickOut} y1={ty} x2={paintL} y2={ty} stroke={stroke} strokeWidth={sw * 0.75} opacity={0.65} />
          <line x1={paintR} y1={ty} x2={paintR + tickOut} y2={ty} stroke={stroke} strokeWidth={sw * 0.75} opacity={0.65} />
        </g>
      ))}

      {/* Free throw line */}
      <line x1={paintL} y1={paintBot} x2={paintR} y2={paintBot} stroke={stroke} strokeWidth={sw} opacity={0.85} />

      {/* FT circle — upper half dashed (sweep=1 = CW = toward basket) */}
      <path
        d={`M ${bx - ftR} ${paintBot} A ${ftR} ${ftR} 0 0 1 ${bx + ftR} ${paintBot}`}
        fill="none" stroke={stroke} strokeWidth={sw}
        strokeDasharray={`${sw * 3} ${sw * 2}`} opacity={0.65}
      />

      {/* FT circle — lower half solid (sweep=0 = CCW = away from basket) */}
      <path
        d={`M ${bx - ftR} ${paintBot} A ${ftR} ${ftR} 0 0 0 ${bx + ftR} ${paintBot}`}
        fill="none" stroke={stroke} strokeWidth={sw} opacity={0.85}
      />

      {/* 3-point corner straights */}
      <line x1={cornerX} y1={0} x2={cornerX} y2={cornerY} stroke={stroke} strokeWidth={sw} opacity={0.85} />
      <line x1={W - cornerX} y1={0} x2={W - cornerX} y2={cornerY} stroke={stroke} strokeWidth={sw} opacity={0.85} />

      {/* 3-point arc (sweep=0 = CCW = curves away from baseline) */}
      <path
        d={`M ${cornerX} ${cornerY} A ${arcR} ${arcR} 0 0 0 ${W - cornerX} ${cornerY}`}
        fill="none" stroke={stroke} strokeWidth={sw} opacity={0.85}
      />
    </>
  );
}
