import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CourtLocationPicker } from '../../src/components/charts/CourtLocationPicker';

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

function renderPicker() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <CourtLocationPicker playerName="#7 Silva" onConfirm={onConfirm} onCancel={onCancel} />,
  );
  return { ...utils, onConfirm, onCancel };
}

// Tap coords are in the rendered frame (basket at the TOP, y ≈ 0.113):
//   (0.5, 0.75) → mirrored (0.5, 0.25) → well beyond the 6.75 m arc → 3pt
//   (0.5, 0.20) → mirrored (0.5, 0.80) → 1.19 m from the basket (paint) → 2pt
function tap(container: HTMLElement, x: number, y: number) {
  const svg = container.querySelector('svg')!;
  fireEvent.click(svg, { clientX: x * RECT.width, clientY: y * RECT.height });
}

describe('CourtLocationPicker', () => {
  it('shows the 3-POINT SHOT banner for a tap beyond the arc', () => {
    const { container } = renderPicker();
    tap(container, 0.5, 0.75);
    expect(screen.getByTestId('shot-classification-banner')).toHaveTextContent('3-POINT SHOT');
  });

  it('shows the 2-POINT SHOT banner for a tap in the paint', () => {
    const { container } = renderPicker();
    tap(container, 0.5, 0.2);
    expect(screen.getByTestId('shot-classification-banner')).toHaveTextContent('2-POINT SHOT');
  });

  it('flips the classification when Override is clicked', () => {
    const { container } = renderPicker();
    tap(container, 0.5, 0.2);
    expect(screen.getByTestId('shot-classification-banner')).toHaveTextContent('2-POINT SHOT');

    fireEvent.click(screen.getByRole('button', { name: /override/i }));
    expect(screen.getByTestId('shot-classification-banner')).toHaveTextContent('3-POINT SHOT');
  });

  it('does not show MADE/MISS buttons before a court tap', () => {
    renderPicker();
    expect(screen.queryByRole('button', { name: /^made$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^miss$/i })).not.toBeInTheDocument();
  });

  it('confirms a made 3-point shot via the MADE button', () => {
    const { container, onConfirm } = renderPicker();
    tap(container, 0.5, 0.75);
    fireEvent.click(screen.getByRole('button', { name: /^made$/i }));
    expect(onConfirm).toHaveBeenCalledWith(0.5, 0.75, '3PM');
  });

  it('confirms a missed 2-point shot via the MISS button', () => {
    const { container, onConfirm } = renderPicker();
    tap(container, 0.5, 0.2);
    fireEvent.click(screen.getByRole('button', { name: /^miss$/i }));
    expect(onConfirm).toHaveBeenCalledWith(0.5, 0.2, '2PA');
  });

  it('confirms an overridden classification', () => {
    const { container, onConfirm } = renderPicker();
    tap(container, 0.5, 0.75); // auto-classified as 3pt
    fireEvent.click(screen.getByRole('button', { name: /override/i })); // dispute → 2pt
    fireEvent.click(screen.getByRole('button', { name: /^made$/i }));
    expect(onConfirm).toHaveBeenCalledWith(0.5, 0.75, '2PM');
  });

  it('cancels when clicking outside the content area', () => {
    const { container, onCancel } = renderPicker();
    fireEvent.click(container.firstChild as Element);
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not cancel when tapping the court', () => {
    const { container, onCancel } = renderPicker();
    tap(container, 0.5, 0.2);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
