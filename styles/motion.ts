import type { Transition } from 'motion/react';

/**
 * Motion constants. Everything animates transform and opacity only. Each
 * value has a reduced-motion twin: shorter, no overshoot, no stagger — a real
 * reduced variant, not a kill switch.
 */
export const STAGGER = 0.04;

export const EASE_OUT: [number, number, number, number] = [0.2, 0.7, 0.2, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

/** Score ring and counters: ~400ms with a slight overshoot. */
export const SPRING_SCORE: Transition = { type: 'spring', stiffness: 160, damping: 17, mass: 1 };
/** Projected-score bumps on toggles: quicker, still springy. */
export const SPRING_TICK: Transition = { type: 'spring', stiffness: 260, damping: 22, mass: 0.8 };
/** Layout and shared-element moves. */
export const SPRING_LAYOUT: Transition = { type: 'spring', stiffness: 380, damping: 34, mass: 1 };
/** Small UI: chips, rows, buttons. */
export const TWEEN_UI: Transition = { type: 'tween', duration: 0.2, ease: EASE_OUT };
export const TWEEN_SLOW: Transition = { type: 'tween', duration: 0.32, ease: EASE_OUT };

export const REDUCED: Transition = { type: 'tween', duration: 0.15, ease: 'linear' };

export function pick(reduced: boolean | null, full: Transition, low: Transition = REDUCED): Transition {
  return reduced ? low : full;
}

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const dock = {
  initial: { opacity: 0, x: 16, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 8, scale: 0.98 },
};
