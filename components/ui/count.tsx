'use client';

import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { SPRING_SCORE, REDUCED, SPRING_TICK } from '@/styles/motion';
import { cn } from '@/lib/cn';

/**
 * A number that springs to its new value. Interruptible: a new value mid-flight
 * retargets the running animation. Renders text (not a canvas) so it stays
 * selectable and readable by assistive tech; the live region gets the final value.
 */
export function Count({ value, decimals = 0, className, spring = 'score', prefix = '', suffix = '' }: { value: number; decimals?: number; className?: string; spring?: 'score' | 'tick'; prefix?: string; suffix?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const controls = animate(from, value, {
      ...(reduced ? REDUCED : spring === 'tick' ? SPRING_TICK : SPRING_SCORE),
      onUpdate: (v) => {
        current.current = v;
        setShown(v);
      },
      onComplete: () => {
        current.current = value;
        setShown(value);
      },
    });
    return () => controls.stop();
  }, [value, reduced, spring]);
  const fixed = Math.max(0, Math.min(99.9, shown)).toFixed(decimals);
  return (
    <span className={cn('num', className)} aria-live="off">
      {prefix}
      {fixed}
      {suffix}
      <span className="sr-only" aria-live="polite">
        {prefix}
        {value.toFixed(decimals)}
        {suffix}
      </span>
    </span>
  );
}
