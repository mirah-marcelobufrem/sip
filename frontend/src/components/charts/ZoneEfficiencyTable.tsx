import { useMemo } from 'react';
import { classifyShotZone, type ShotZone } from './courtLines';

export interface ZoneShot {
  x: number | null;
  y: number | null;
  made: boolean;
}

interface ZoneEfficiencyTableProps {
  shots: ZoneShot[];
}

const ZONE_ORDER: ShotZone[] = [
  'restricted_area',
  'paint',
  'mid_range_left',
  'mid_range_center',
  'mid_range_right',
  'left_corner_3',
  'right_corner_3',
  'left_wing_3',
  'right_wing_3',
  'top_arc_3',
];

const ZONE_LABELS: Record<ShotZone, string> = {
  restricted_area: 'Restricted Area',
  paint: 'Paint',
  mid_range_left: 'Mid-Range Left',
  mid_range_center: 'Mid-Range Center',
  mid_range_right: 'Mid-Range Right',
  left_corner_3: 'Left Corner 3',
  right_corner_3: 'Right Corner 3',
  left_wing_3: 'Left Wing 3',
  right_wing_3: 'Right Wing 3',
  top_arc_3: 'Top Arc 3',
};

function pct(made: number, attempts: number): string {
  return attempts > 0 ? `${((made / attempts) * 100).toFixed(1)}%` : '—';
}

/** N-05 — per-zone shooting efficiency (zone | M/A | FG%). */
export function ZoneEfficiencyTable({ shots }: ZoneEfficiencyTableProps) {
  const { rows, totalMade, totalAttempts } = useMemo(() => {
    const byZone = new Map<ShotZone, { made: number; attempts: number }>();
    let made = 0;
    let attempts = 0;
    for (const shot of shots) {
      if (shot.x == null || shot.y == null) continue;
      const zone = classifyShotZone(shot.x, shot.y);
      const entry = byZone.get(zone) ?? { made: 0, attempts: 0 };
      entry.attempts += 1;
      attempts += 1;
      if (shot.made) {
        entry.made += 1;
        made += 1;
      }
      byZone.set(zone, entry);
    }
    return {
      rows: ZONE_ORDER.filter((z) => byZone.has(z)).map((z) => ({ zone: z, ...byZone.get(z)! })),
      totalMade: made,
      totalAttempts: attempts,
    };
  }, [shots]);

  if (totalAttempts === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400" data-testid="zone-table-empty">
        No located shots to break down by zone yet.
      </p>
    );
  }

  return (
    <table className="w-full text-sm" data-testid="zone-efficiency-table">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          <th className="py-1.5 pr-2 font-medium">Zone</th>
          <th className="py-1.5 px-2 font-medium text-right">M/A</th>
          <th className="py-1.5 pl-2 font-medium text-right">FG%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.zone} className="border-b border-gray-100 dark:border-gray-800">
            <td className="py-1.5 pr-2 text-gray-900 dark:text-gray-100">{ZONE_LABELS[r.zone]}</td>
            <td className="py-1.5 px-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
              {r.made}/{r.attempts}
            </td>
            <td className="py-1.5 pl-2 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">
              {pct(r.made, r.attempts)}
            </td>
          </tr>
        ))}
        <tr>
          <td className="py-1.5 pr-2 font-semibold text-gray-900 dark:text-gray-100">Total</td>
          <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
            {totalMade}/{totalAttempts}
          </td>
          <td className="py-1.5 pl-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
            {pct(totalMade, totalAttempts)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
