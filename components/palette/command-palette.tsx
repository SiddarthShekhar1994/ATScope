'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTransitionRouter } from 'next-view-transitions';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useAllCommands, type Command } from './registry';
import { Kbd } from '@/components/ui/primitives';
import { IconSearch } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { pick, SPRING_LAYOUT } from '@/styles/motion';

/**
 * ⌘K / Ctrl+K palette. Global navigation plus whatever the current screen
 * registers. Keyboard-first: arrows move, Enter runs, Escape closes.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const router = useTransitionRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const scoped = useAllCommands();

  const globals: Command[] = useMemo(
    () => [
      { id: 'go-home', label: 'Go to landing', group: 'Navigate', run: () => router.push('/'), keywords: ['home'] },
      { id: 'go-upload', label: 'Scan a new resume', group: 'Navigate', shortcut: 'N', run: () => router.push('/upload'), keywords: ['upload', 'new'] },
      { id: 'go-history', label: 'Version history', group: 'Navigate', run: () => router.push('/history'), keywords: ['runs', 'compare'] },
    ],
    [router],
  );
  const all = useMemo(() => [...scoped, ...globals], [scoped, globals]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((c) => c.label.toLowerCase().includes(needle) || c.group.toLowerCase().includes(needle) || c.keywords?.some((k) => k.includes(needle)));
  }, [all, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  useEffect(() => setIdx(0), [q]);

  const run = (c: Command) => {
    setOpen(false);
    c.run();
  };
  const groups = [...new Set(filtered.map((c) => c.group))];

  return (
    <AnimatePresence>
      {open ? (
        <motion.div key="palette" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="fixed inset-0 z-[60] flex items-start justify-center bg-[rgba(0,0,0,0.55)] p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <motion.div role="dialog" aria-modal="true" aria-label="Command palette" initial={{ opacity: 0, y: -8, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.985 }} transition={pick(reduced, SPRING_LAYOUT)} className="panel w-full max-w-lg overflow-hidden shadow-3">
            <div className="flex items-center gap-2 border-b border-line px-3">
              <IconSearch className="text-fg-2" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setIdx((i) => Math.min(filtered.length - 1, i + 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setIdx((i) => Math.max(0, i - 1));
                  } else if (e.key === 'Enter' && filtered[idx]) run(filtered[idx]);
                }}
                placeholder="Type a command or section…"
                aria-label="Search commands"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={filtered[idx] ? `cmd-${filtered[idx].id}` : undefined}
                className="h-12 w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-3"
                style={{ fontSize: 16 }}
              />
              <Kbd>esc</Kbd>
            </div>
            <ul id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {filtered.length === 0 ? <li className="px-3 py-6 text-center text-sm text-fg-2">No commands match “{q}”.</li> : null}
              {groups.map((g) => (
                <li key={g} role="presentation">
                  <p className="t-label px-3 pb-1 pt-2">{g}</p>
                  <ul role="group" aria-label={g}>
                    {filtered
                      .filter((c) => c.group === g)
                      .map((c) => {
                        const i = filtered.indexOf(c);
                        return (
                          <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => run(c)} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-r2 px-3 py-2 text-sm', i === idx ? 'bg-bg-3 text-fg' : 'text-fg-1')}>
                            <span className="truncate">
                              {c.label}
                              {c.hint ? <span className="ml-2 text-fg-2">{c.hint}</span> : null}
                            </span>
                            {c.shortcut ? <Kbd>{c.shortcut}</Kbd> : null}
                          </li>
                        );
                      })}
                  </ul>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 border-t border-line px-3 py-2 text-xs text-fg-2">
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> move
              </span>
              <span>
                <Kbd>↵</Kbd> run
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
