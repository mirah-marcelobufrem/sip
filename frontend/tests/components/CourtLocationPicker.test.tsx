import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CourtLocationPicker, type ShotStatType } from '../../src/components/charts/CourtLocationPicker';

const RECT = {
  left: 0,
  top: 0,
  width: 300,
  height: 280,
  right: 300,
  bottom: 280,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

beforeEach(() => {
  // jsdom has no layout — give the SVG a real bounding box
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(RECT);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPicker(statType: ShotStatType = '2PM') {
  const onConfirm = vi.fn();
  const onSkip = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <CourtLocationPicker
      statType={statType}
      playerName="#7 Silva"
      onConfirm={onConfirm}
      onSkip={onSkip}
      onCancel={onCancel}
    />,
  );
  return { ...utils, onConfirm, onSkip, onCancel };
}

// Tap coords are in the rendered frame (basket at the TOP, y ≈ 0.113):
//   (0.5, 0.75) → mirrored (0.5, 0.25) → well beyond the 6.75 m arc → 3pt
//   (0.5, 0.20) → mirrored (0.5, 0.80) → 1.19 m from the basket (paint) → 2pt
function tap(container: HTMLElement, x: number, y: number) {
  const svg = container.querySelector('svg')!;
  fireEvent.click(svg, { clientX: x * RECT.width, clientY: y * RECT.height });
}

describe('CourtLocationPicker auto-classification', () => {
  it('shows the 3-POINT SHOT banner for a tap beyond the arc', () => {
    const { container } = renderPicker('2PM');
    tap(container, 0.5, 0.75);
    const banner = screen.getByTestId('shot-classification-banner');
    expect(banner).toHaveTextContent('3-POINT SHOT');
  });

  it('shows the 2-POINT SHOT banner for a tap in the paint', () => {
    const { container } = renderPicker('2PM');
    tap(container, 0.5, 0.2);
    const banner = screen.getByTestId('shot-classification-banner');
    expect(banner).toHaveTextContent('2-POINT SHOT');
  });

  it('flips the classification when Override is clicked', () => {
    const { container } = renderPicker('2PM');
    tap(container, 0.5, 0.2);
    expect(screen.getByTestId('shot-classification-banner')).toHaveTextContent('2-POINT SHOT');

    fireEvent.click(screen.getByRole('button', { name: /override/i }));
    expect(screen.getByTestId('shot-classification-banner')).toHaveTextContent('3-POINT SHOT');
  });

  it('submits the auto-derived statType for a made 3-point shot', () => {
    const { container, onConfirm } = renderPicker('2PM');
    tap(container, 0.5, 0.75);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(0.5, 0.75, '3PM');
  });

  it('preserves missed status when deriving the statType', () => {
    const { container, onConfirm } = renderPicker('2PA');
    tap(container, 0.5, 0.75);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(0.5, 0.75, '3PA');
  });

  it('submits the overridden statType after Override', () => {
    const { container, onConfirm } = renderPicker('3PM');
    tap(container, 0.5, 0.75); // auto-classified as 3pt
    fireEvent.click(screen.getByRole('button', { name: /override/i })); // dispute → 2pt
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith(0.5, 0.75, '2PM');
  });

  it('keeps Skip location available before a tap and calls onSkip', () => {
    const { onSkip } = renderPicker('2PM');
    fireEvent.click(screen.getByRole('button', { name: /skip location/i }));
    expect(onSkip).toHaveBeenCalled();
  });
});
