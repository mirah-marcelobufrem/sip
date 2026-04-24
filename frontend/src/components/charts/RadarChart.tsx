import { useMemo } from 'react';

interface RadarAxis {
  label: string;
  value: number; // 0–10
}

interface RadarChartProps {
  axes: RadarAxis[];
  size?: number;
  color?: string;
}

export function RadarChart({ axes, size = 200, color = '#1a56db' }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const labelRadius = size * 0.47;
  const n = axes.length;

  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const gridLevels = [2, 4, 6, 8, 10];

  const gridPolygon = useMemo(
    () =>
      (level: number) =>
        Array.from({ length: n }, (_, i) => {
          const r = (level / 10) * radius;
          const a = angleFor(i);
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(' '),
    [n, radius, cx, cy],
  );

  const dataPolygon = useMemo(
    () =>
      axes
        .map((ax, i) => {
          const r = (Math.min(Math.max(ax.value, 0), 10) / 10) * radius;
          const a = angleFor(i);
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        })
        .join(' '),
    [axes, radius, cx, cy],
  );

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {/* Grid rings */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={gridPolygon(level)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={1}
        />
      ))}

      {/* Spokes */}
      {Array.from({ length: n }, (_, i) => {
        const a = angleFor(i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + radius * Math.cos(a)}
            y2={cy + radius * Math.sin(a)}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygon */}
      <polygon points={dataPolygon} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />

      {/* Data dots */}
      {axes.map((ax, i) => {
        const r = (Math.min(Math.max(ax.value, 0), 10) / 10) * radius;
        const a = angleFor(i);
        return (
          <circle
            key={i}
            cx={cx + r * Math.cos(a)}
            cy={cy + r * Math.sin(a)}
            r={3}
            fill={color}
          />
        );
      })}

      {/* Labels */}
      {axes.map((ax, i) => {
        const a = angleFor(i);
        const lx = cx + labelRadius * Math.cos(a);
        const ly = cy + labelRadius * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.1 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        return (
          <text
            key={i}
            x={lx}
            y={ly + 4}
            textAnchor={anchor}
            fontSize={9}
            fill="#6b7280"
            fontFamily="system-ui, sans-serif"
          >
            {ax.label}
            {ax.value > 0 && (
              <tspan fill={color} fontWeight="600">
                {' '}{ax.value}
              </tspan>
            )}
          </text>
        );
      })}
    </svg>
  );
}
