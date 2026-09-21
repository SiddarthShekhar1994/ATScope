'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Query-string state that survives reload and deep-links. Uses the History API
 * directly (Next integrates with pushState/replaceState), so tab switches do
 * not refetch the route or reset scroll. History writes happen outside React's
 * render phase: the router listens to them and must not be updated mid-render.
 */
export function useUrlState<T extends Record<string, string | undefined>>(defaults: T) {
  const params = useSearchParams();
  const pathname = usePathname();
  const defaultsRef = useRef(defaults);
  const read = useCallback((): T => {
    const out = { ...defaultsRef.current };
    for (const k of Object.keys(defaultsRef.current)) {
      const v = params.get(k);
      if (v !== null) (out as Record<string, string | undefined>)[k] = v;
    }
    return out;
  }, [params]);
  const [state, setState] = useState<T>(read);
  const current = useRef(state);
  current.current = state;
  useEffect(() => {
    const next = read();
    if (Object.keys(next).some((k) => next[k] !== current.current[k])) setState(next);
  }, [read]);
  const set = useCallback(
    (patch: Partial<T>, mode: 'push' | 'replace' = 'replace') => {
      const next = { ...current.current, ...patch };
      current.current = next;
      const sp = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined || v === '' || v === defaultsRef.current[k as keyof T]) sp.delete(k);
        else sp.set(k, String(v));
      }
      const url = `${pathname}${sp.toString() ? `?${sp}` : ''}${window.location.hash}`;
      if (mode === 'push') window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
      setState(next);
    },
    [pathname],
  );
  return [state, set] as const;
}
