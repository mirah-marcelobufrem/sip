// Shared SVG court geometry — renders inside an existing <svg>.
// FIBA half-court: 15 m wide × 14 m deep.
// Normalized: x ∈ [0,1] over 15 m, y ∈ [0,1] over 14 m.
// Designed for H = W * 14/15 so all arcs render as true circles (rx = ry).

// FIBA 3-point classification — pure function, mirrored by the backend (must agree).
// Frame: normalized half-court coords with the basket at (0.5, 0.885), i.e. the
// baseline at y = 1. x ∈ [0,1] over 15 m width, y ∈ [0,1] over 14 m depth.
// Three-point when real distance from the basket exceeds 6.75 m, plus the
// straight corner sections (x < 0.085 or x > 0.915 ⇒ always 3pt).
// NOTE: <CourtLines> renders the basket at the TOP (y ≈ 0.113); callers using
// tap coordinates from that rendering must pass (x, 1 - y).
export function isThreePointArea(x: number, y: number): boolean {
  if (x < 0.085 || x > 0.915) return true;
  const dx = (x - 0.5) * 15;
  const dy = (y - 0.885) * 14;
  return Math.sqrt(dx * dx + dy * dy) > 6.75;
}

export type ShotZone =
  | 'restricted_area'
  | 'paint'
  | 'mid_range_left'
  | 'mid_range_center'
  | 'mid_range_right'
  | 'left_corner_3'
  | 'left_wing_3'
  | 'top_arc_3'
  | 'right_wing_3'
  | 'right_corner_3';

// Shot zone classification — STORAGE frame (basket at (0.5, 0.113), baseline
// at y = 0), i.e. xCourt/yCourt exactly as stored in stat_events and rendered
// by <CourtLines>. Ported verbatim from classifyShotZone in
// backend/src/domain/stat-calculators.ts — the two MUST stay formula-identical.
export function classifyShotZone(x: number, y: number): ShotZone {
  // FIBA half-court: x∈[0,1] over 15 m width, y∈[0,1] over 14 m depth.
  // Basket center: 1.575 m from baseline → (0.5, 0.113).
  const dx = (x - 0.5) * 15;   // physical metres, x-axis
  const dy = (y - 0.113) * 14; // physical metres, y-axis
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Restricted area: 1.25 m arc
  if (dist < 1.25) return 'restricted_area';

  // Paint (key): 4.9 m wide (±2.45 m), 5.8 m deep
  if (x > 0.337 && x < 0.663 && y < 0.414) return 'paint';

  // 3-point boundary: 6.75 m arc + corner straights at x=0.06/0.94 up to y=0.213
  const isThreePoint =
    dist > 6.75 ||
    (x < 0.06 && y < 0.213) ||
    (x > 0.94 && y < 0.213);

  if (!isThreePoint) {
    if (x < 0.4) return 'mid_range_left';
    if (x > 0.6) return 'mid_range_right';
    return 'mid_range_center';
  }

  if (x < 0.06) return 'left_corner_3';
  if (x > 0.94) return 'right_corner_3';
  if (x < 0.35) return 'left_wing_3';
  if (x > 0.65) return 'right_wing_3';
  return 'top_arc_3';
}

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
