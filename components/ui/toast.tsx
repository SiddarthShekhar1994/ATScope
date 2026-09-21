'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Button } from './button';
import { IconAlert, IconCheck, IconUndo, IconX } from './icons';
import { pick, SPRING_LAYOUT, fadeUp } from '@/styles/motion';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: 'neutral' | 'good' | 'bad';
  /** An undo window: the action runs when the toast times out unless undone. */
  undo?: { label?: string; onUndo: () => void; onCommit?: () => void; ms?: number };
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const Ctx = createContext<{ toast: (o: ToastOptions) => void } | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx.toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const reduced = useReducedMotion();
  const dismiss = useCallback((id: number, commit = true) => {
    setItems((list) => {
      const it = list.find((x) => x.id === id);
      if (it?.undo && commit) it.undo.onCommit?.();
      return list.filter((x) => x.id !== id);
    });
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);
  const toast = useCallback(
    (o: ToastOptions) => {
      const id = Date.now() + Math.random();
      setItems((list) => [...list.slice(-3), { ...o, id }]);
      const ms = o.undo?.ms ?? o.durationMs ?? (o.undo ? 6000 : 3600);
      timers.current.set(id, setTimeout(() => dismiss(id, true), ms));
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div key={t.id} layout {...fadeUp} transition={pick(reduced, SPRING_LAYOUT)} className="panel pointer-events-auto flex w-full max-w-sm items-start gap-3 p-3 text-sm shadow-2" role="status">
              <span className={t.tone === 'bad' ? 'text-bad' : t.tone === 'good' ? 'text-good' : 'text-fg-1'} aria-hidden>
                {t.tone === 'bad' ? <IconAlert /> : t.tone === 'good' ? <IconCheck /> : <IconUndo />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{t.title}</p>
                {t.description ? <p className="mt-0.5 text-fg-1">{t.description}</p> : null}
              </div>
              {t.undo ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    t.undo!.onUndo();
                    dismiss(t.id, false);
                  }}
                >
                  {t.undo.label ?? 'Undo'}
                </Button>
              ) : null}
              <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id, true)} className="rounded-r1 p-1 text-fg-2 hover:text-fg">
                <IconX size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
