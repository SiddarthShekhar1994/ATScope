'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Count } from '@/components/ui/count';
import { SPRING_SCORE, REDUCED } from '@/styles/motion';
import { bandFor, BAND_LABEL } from '@/lib/score/types';
import { cn } from '@/lib/cn';

/**
 * Score ring: the arc draws with stroke-dashoffset on a spring while the number
 * counts up in the middle. Band is shown as text next to the colour.
 */
export function ScoreRing({ score, size = 200, stroke = 10, label = 'ATS score', className, showBand = true, id }: { score: number | undefined; size?: number; stroke?: number; label?: string; className?: string; showBand?: boolean; id?: string }) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = score ?? 0;
  const pct = Math.max(0, Math.min(1, value / 100));
  const band = score === undefined ? undefined : bandFor(value);
  const tone = band === 'strong' ? 'var(--good)' : band === 'competitive' ? 'var(--accent)' : band === 'borderline' ? 'var(--accent)' : 'var(--bad)';
  return (
    <figure className={cn('relative inline-flex flex-col items-center', className)} style={id ? ({ viewTransitionName: id } as React.CSSProperties) : undefined} aria-label={`${label}: ${score === undefined ? 'pending' : `${value} out of 99, ${BAND_LABEL[band!]}`}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden className="block -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={stroke} />
        {/* Tick marks every 10 points, instrument style. */}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          // Rounded so server and client render identical attributes (float noise differs between runtimes).
          const rd = (n: number) => Math.round(n * 100) / 100;
          const x1 = rd(size / 2 + Math.cos(a) * (r + stroke / 2 + 3));
          const y1 = rd(size / 2 + Math.sin(a) * (r + stroke / 2 + 3));
          const x2 = rd(size / 2 + Math.cos(a) * (r + stroke / 2 + 7));
          const y2 = rd(size / 2 + Math.sin(a) * (r + stroke / 2 + 7));
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--line-strong)" strokeWidth={1} />;
        })}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={reduced ? REDUCED : SPRING_SCORE}
          style={{ filter: `drop-shadow(0 0 ${stroke}px ${tone}33)` }}
        />
      </svg>
      <figcaption className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="t-label">{label}</span>
        <span className="num leading-none text-fg" style={{ fontSize: size * 0.3, fontWeight: 500 }}>
          {score === undefined ? <span className="text-fg-3">––</span> : <Count value={value} />}
        </span>
        {showBand && band ? (
          <span className="mt-1 flex items-center gap-1.5 text-xs text-fg-1">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
            {BAND_LABEL[band]}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
