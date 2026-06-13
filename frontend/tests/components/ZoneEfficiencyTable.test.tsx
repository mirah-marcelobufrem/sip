import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ZoneEfficiencyTable } from '../../src/components/charts/ZoneEfficiencyTable';
import { classifyShotZone } from '../../src/components/charts/courtLines';

// STORAGE frame (basket at (0.5, 0.113)) — must stay formula-identical to
// backend classifyShotZone in stat-calculators.ts.
describe('classifyShotZone (frontend port, STORAGE frame)', () => {
  it('classifies a shot at the rim as restricted area', () => {
    expect(classifyShotZone(0.5, 0.15)).toBe('restricted_area');
  });

  it('classifies a shot in the key beyond the arc as paint', () => {
    expect(classifyShotZone(0.5, 0.3)).toBe('paint');
  });

  it('classifies mid-range bands left/center/right', () => {
    expect(classifyShotZone(0.38, 0.45)).toBe('mid_range_left');
    expect(classifyShotZone(0.5, 0.5)).toBe('mid_range_center');
    expect(classifyShotZone(0.62, 0.45)).toBe('mid_range_right');
  });

  it('classifies corner threes on both sides', () => {
    expect(classifyShotZone(0.03, 0.1)).toBe('left_corner_3');
    expect(classifyShotZone(0.97, 0.1)).toBe('right_corner_3');
  });

  it('classifies wing and top-arc threes', () => {
    expect(classifyShotZone(0.2, 0.5)).toBe('left_wing_3');
    expect(classifyShotZone(0.8, 0.5)).toBe('right_wing_3');
    expect(classifyShotZone(0.5, 0.7)).toBe('top_arc_3');
  });

  it('respects the 6.75 m arc boundary straight up the floor', () => {
    // dy metres → normalized y = 0.113 + d/14
    expect(classifyShotZone(0.5, 0.113 + 6.74 / 14)).toBe('mid_range_center');
    expect(classifyShotZone(0.5, 0.113 + 6.76 / 14)).toBe('top_arc_3');
  });
});

describe('ZoneEfficiencyTable (N-05)', () => {
  it('groups shots by zone with M/A, FG% and a totals row', () => {
    render(
      <ZoneEfficiencyTable
        shots={[
          { x: 0.5, y: 0.15, made: true }, // restricted area make
          { x: 0.5, y: 0.16, made: false }, // restricted area miss
          { x: 0.5, y: 0.7, made: true }, // top arc 3 make
        ]}
      />,
    );

    expect(screen.getByTestId('zone-efficiency-table')).toBeInTheDocument();
    expect(screen.getByText('Restricted Area')).toBeInTheDocument();
    expect(screen.getByText('Top Arc 3')).toBeInTheDocument();
    expect(screen.getByText('1/2')).toBeInTheDocument(); // restricted area M/A
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument(); // totals M/A
    expect(screen.getByText('66.7%')).toBeInTheDocument();
  });

  it('omits zones without attempts', () => {
    render(<ZoneEfficiencyTable shots={[{ x: 0.5, y: 0.3, made: true }]} />);
    expect(screen.getByText('Paint')).toBeInTheDocument();
    expect(screen.queryByText('Left Corner 3')).not.toBeInTheDocument();
  });

  it('skips shots without coordinates and shows the empty state when none remain', () => {
    render(<ZoneEfficiencyTable shots={[{ x: null, y: null, made: true }]} />);
    expect(screen.getByTestId('zone-table-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('zone-efficiency-table')).not.toBeInTheDocument();
  });
});
