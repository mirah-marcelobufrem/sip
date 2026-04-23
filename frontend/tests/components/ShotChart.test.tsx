import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShotChart } from '../../src/components/charts/ShotChart';

describe('ShotChart', () => {
  it('renders an SVG element', () => {
    const { container } = render(<ShotChart shots={[]} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders dots for shots with coordinates', () => {
    const shots = [
      { x: 0.5, y: 0.5, made: true, type: '2PM' as const },
      { x: 0.3, y: 0.3, made: false, type: '2PA' as const },
    ];
    const { container } = render(<ShotChart shots={shots} />);
    const circles = container.querySelectorAll('circle');
    // basket circle + 2 shot dots
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });
});
