'use client';

import type { KeywordMap as KeywordMapT } from '@/lib/score/types';
import { Chip, Readout } from '@/components/ui/primitives';
import { displayTerm } from '@/lib/rewrite/structural';
import { Count } from '@/components/ui/count';

/**
 * Present / missing / overused terms against the target. Every chip is
 * clickable: present and overused chips highlight the lines where the term
 * appears; missing chips point at the skills line that should carry them.
 */
export function KeywordMapView({ map, onPick, activeTerm }: { map: KeywordMapT; onPick: (term: string, lineRefs: string[]) => void; activeTerm?: string | null }) {
  const supported = map.missing.filter((m) => m.supportedBy?.length);
  const unsupported = map.missing.filter((m) => !m.supportedBy?.length);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Readout label="weighted match" value={<Count value={map.jdMatchPercent} suffix="%" />} tone={map.jdMatchPercent >= 70 ? 'good' : map.jdMatchPercent >= 45 ? 'accent' : 'bad'} />
        <Readout label="present" value={map.present.length} tone="good" />
        <Readout label="missing" value={map.missing.length} tone={map.missing.length ? 'bad' : 'good'} />
        <Readout label="overused" value={map.overused.length} tone={map.overused.length ? 'bad' : 'muted'} />
      </div>
      <p className="text-sm text-fg-1">
        Target: <span className="text-fg">{map.targetLabel}</span>
        <span className="text-fg-2"> · {map.targetSource === 'jd' ? 'terms extracted from the pasted description' : map.targetSource === 'role' ? 'role preset you chose' : 'role inferred from your titles — pick a role or paste a description for a sharper target'}</span>
      </p>
      <Group title="Present" hint="Weighted by importance. Click to see where.">
        {map.present.length === 0 ? <Empty>None of the target terms appear.</Empty> : null}
        {map.present.map((k) => (
          <Chip key={k.term} state="present" count={k.count} onClick={() => onPick(k.term, k.lineRefs)} title={`Matched as “${k.matchedAs}” on ${k.lineRefs.join(', ')} · weight ${k.weight}`} className={activeTerm === k.term ? 'ring-1 ring-accent' : ''}>
            {displayTerm(k.term)}
            <span className="text-[10px] text-fg-2">w{k.weight}</span>
          </Chip>
        ))}
      </Group>
      <Group title="Missing but supported" hint="Your document already implies these. The rewrite adds them.">
        {supported.length === 0 ? <Empty>Nothing to add safely.</Empty> : null}
        {supported.map((k) => (
          <Chip key={k.term} state="accent" onClick={() => onPick(k.term, [])} title={`Implied by ${k.supportedBy!.join(', ')} · weight ${k.weight}`} className={activeTerm === k.term ? 'ring-1 ring-accent' : ''}>
            {displayTerm(k.term)}
            <span className="text-[10px] text-fg-2">← {displayTerm(k.supportedBy![0])}</span>
          </Chip>
        ))}
      </Group>
      <Group title="Missing" hint="Nothing in the document supports these. Add only if true.">
        {unsupported.length === 0 ? <Empty>Every remaining target term is covered.</Empty> : null}
        {unsupported.map((k) => (
          <Chip key={k.term} state="missing" onClick={() => onPick(k.term, [])} title={`Weight ${k.weight}${k.category ? ` · ${k.category}` : ''}`} className={activeTerm === k.term ? 'ring-1 ring-accent' : ''}>
            {displayTerm(k.term)}
            <span className="text-[10px] text-fg-3">w{k.weight}</span>
          </Chip>
        ))}
      </Group>
      {map.overused.length ? (
        <Group title="Overused" hint="Past the limit, repetition reads as stuffing.">
          {map.overused.map((k) => (
            <Chip key={k.term} state="overused" count={k.count} onClick={() => onPick(k.term, k.lineRefs)} title={`${k.count} mentions, limit ${k.limit}`} className={activeTerm === k.term ? 'ring-1 ring-accent' : ''}>
              {displayTerm(k.term)}
            </Chip>
          ))}
        </Group>
      ) : null}
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="t-label">{title}</h3>
        <span className="text-xs text-fg-3">{hint}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-r1 border border-dashed border-line px-3 py-2 text-xs text-fg-2">{children}</p>;
}
