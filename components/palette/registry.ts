'use client';

import { useEffect, useSyncExternalStore } from 'react';

/**
 * Tiny command registry for the ⌘K palette. Screens register their own
 * commands while mounted (tabs, accept-all, export…) and the palette merges
 * them with the global ones.
 */
export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  shortcut?: string;
  run: () => void;
  keywords?: string[];
}

let commands = new Map<string, Command[]>();
const listeners = new Set<() => void>();
let snapshot: Command[] = [];

function emit() {
  snapshot = [...commands.values()].flat();
  for (const l of listeners) l();
}

export function registerCommands(scope: string, list: Command[]): () => void {
  commands.set(scope, list);
  emit();
  return () => {
    commands.delete(scope);
    emit();
  };
}

export function usePaletteCommands(scope: string, list: Command[], deps: unknown[] = []) {
  useEffect(() => registerCommands(scope, list), [scope, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useAllCommands(): Command[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
}

export function resetCommands() {
  commands = new Map();
  emit();
}
