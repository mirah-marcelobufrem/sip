import { describe, it, expect } from 'vitest';
import { formatHeight, formatWeight } from '../../src/lib/format';

describe('formatHeight (N-12)', () => {
  it('formats metric heights as centimetres', () => {
    expect(formatHeight(193, 'metric')).toBe('193 cm');
  });

  it('formats imperial heights as feet and inches, rounded to the nearest inch', () => {
    expect(formatHeight(183, 'imperial')).toBe(`6'0"`); // 72.05 in → 6'0"
    expect(formatHeight(193, 'imperial')).toBe(`6'4"`); // 75.98 in → 6'4"
    expect(formatHeight(160, 'imperial')).toBe(`5'3"`); // 62.99 in → 5'3"
  });

  it('renders a dash for missing values', () => {
    expect(formatHeight(null, 'metric')).toBe('—');
    expect(formatHeight(undefined, 'imperial')).toBe('—');
  });
});

describe('formatWeight (N-12)', () => {
  it('formats metric weights as kilograms', () => {
    expect(formatWeight(88, 'metric')).toBe('88 kg');
  });

  it('formats imperial weights as pounds, rounded', () => {
    expect(formatWeight(88, 'imperial')).toBe('194 lb'); // 194.01
    expect(formatWeight(100, 'imperial')).toBe('220 lb'); // 220.46
  });

  it('renders a dash for missing values', () => {
    expect(formatWeight(null, 'metric')).toBe('—');
    expect(formatWeight(undefined, 'imperial')).toBe('—');
  });
});
