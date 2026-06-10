import { describe, it, expect } from 'vitest';
import { isThreePointArea } from '../../src/components/charts/courtLines';

// Frame: basket at (0.5, 0.885), x over 15 m, y over 14 m, baseline at y = 1.
describe('isThreePointArea', () => {
  it('classifies a deep corner 3 as three-point area', () => {
    expect(isThreePointArea(0.05, 0.95)).toBe(true);
  });

  it('classifies the paint as two-point area', () => {
    expect(isThreePointArea(0.5, 0.8)).toBe(false);
  });

  it('classifies the top of the arc as three-point area', () => {
    expect(isThreePointArea(0.5, 0.3)).toBe(true);
  });

  it('classifies a point just inside the 6.75 m arc as two-point', () => {
    // 6.74 m from the basket straight up the floor
    expect(isThreePointArea(0.5, 0.885 - 6.74 / 14)).toBe(false);
  });

  it('classifies a point just outside the 6.75 m arc as three-point', () => {
    expect(isThreePointArea(0.5, 0.885 - 6.76 / 14)).toBe(true);
  });

  it('applies the left corner threshold at x < 0.085', () => {
    expect(isThreePointArea(0.084, 0.95)).toBe(true);
    // Just inside the corner line and within arc distance → two-point
    expect(isThreePointArea(0.086, 0.95)).toBe(false);
  });

  it('applies the right corner threshold at x > 0.915', () => {
    expect(isThreePointArea(0.916, 0.95)).toBe(true);
    expect(isThreePointArea(0.914, 0.95)).toBe(false);
  });
});
