'use client';

import { useEffect, useState } from 'react';
import { readStreamableValue } from '@ai-sdk/rsc';
import { useTransitionRouter } from 'next-view-transitions';
import type { ParsedResume } from '@/lib/parse/types';
import type { Analysis } from '@/lib/schema/analysis';
import { useAnalysisFeed } from '@/lib/analysis/client';
import { startAnalysis } from '@/app/actions/analysis';
import { AnalyzeScreen } from './analyze-screen';
import { Button, ButtonLink } from '@/components/ui/button';
import { IconAlert } from '@/components/ui/icons';

type StartResult = Awaited<ReturnType<typeof startAnalysis>>;
const inflight = new Map<string, Promise<StartResult>>();
function startOnce(id: string): Promise<StartResult> {
  let p = inflight.get(id);
  if (!p) {
    p = startAnalysis(id);
    inflight.set(id, p);
    // Allow a fresh run on the next visit once this one has settled.
    p.finally(() => setTimeout(() => inflight.delete(id), 60_000));
  }
  return p;
}

/**
 * Starts the server action stream on mount and folds events into the feed.
 * When the stream finishes, waits just long enough for the last dock animation
 * to land, then moves to the report with a view transition.
 */
export function AnalyzeLive({ doc, seed }: { doc: ParsedResume; seed: Analysis }) {
  const { state, push } = useAnalysisFeed(seed);
  const router = useTransitionRouter();
  const [modelAvailable, setModelAvailable] = useState<boolean | undefined>(undefined);
  const [fatal, setFatal] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    // The action is started once per document (a module-level cache survives
    // StrictMode's mount → unmount → mount in development); every mount reads
    // the streamable value from its beginning, so a cancelled reader is harmless.
    let cancelled = false;
    (async () => {
      const res = await startOnce(doc.id);
      if ('error' in res) {
        setFatal(res.error ?? 'The analysis could not start.');
        return;
      }
      if (cancelled) return;
      setModelAvailable(res.modelAvailable);
      try {
        for await (const ev of readStreamableValue(res.stream)) {
          if (cancelled) break;
          if (ev) push(ev);
        }
      } catch (err) {
        if (!cancelled) setFatal((err as Error).message ?? 'The analysis stream was interrupted.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.id, push]);

  useEffect(() => {
    if (!state.done || state.error) return;
    setHolding(true);
    // Let the final dock animations settle (real ones, not padding), then go.
    const t = setTimeout(() => router.push(`/report/${doc.id}`), 650);
    return () => clearTimeout(t);
  }, [state.done, state.error, doc.id, router]);

  if (fatal || state.error) {
    return (
      <div className="panel mx-auto mt-10 max-w-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-bad">
            <IconAlert />
          </span>
          <div>
            <h2 className="font-semibold text-fg">The analysis could not run</h2>
            <p className="mt-1 text-sm text-fg-1">{fatal ?? state.error}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={() => location.reload()}>
                Try again
              </Button>
              <ButtonLink href="/upload" variant="ghost">
                Upload a different file
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <AnalyzeScreen
      doc={doc}
      state={state}
      modelAvailable={modelAvailable}
      caption={
        <p className="text-xs text-fg-2" aria-live="polite">
          {holding ? 'Done. Opening the report…' : modelAvailable === false ? 'Deterministic engine only: no model key is configured, so fixes use templates. Timings are real.' : modelAvailable ? 'Model-written fixes stream in as they are produced. Timings are real.' : 'Connecting…'}
        </p>
      }
    />
  );
}
