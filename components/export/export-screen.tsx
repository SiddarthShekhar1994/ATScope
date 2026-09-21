'use client';

import { useMemo, useState } from 'react';
import type { ParsedResume } from '@/lib/parse/types';
import type { Analysis } from '@/lib/schema/analysis';
import type { Rewrite } from '@/lib/schema/rewrite';
import type { VersionRecord } from '@/lib/store/analyses';
import { useLiveScore } from '@/lib/rewrite/client';
import { buildExportDoc, exportText, unfilledPlaceholders, safeFileStem } from '@/lib/export/model';
import { saveVersionAction, createShareAction } from '@/app/actions/analysis';
import { usePaletteCommands } from '@/components/palette/registry';
import { useToast } from '@/components/ui/toast';
import { FlowNav } from '@/components/report/flow-nav';
import { ScoreRing } from '@/components/report/score-ring';
import { EngineReadouts } from '@/components/report/engine-readouts';
import { Button, ButtonLink } from '@/components/ui/button';
import { Readout } from '@/components/ui/primitives';
import { IconAlert, IconDownload, IconLink, IconHistory, IconCopy } from '@/components/ui/icons';
import { CATEGORY_META } from '@/lib/score/types';
import { cn } from '@/lib/cn';

/**
 * Export: the final score, the three ATS-safe formats, and the two things that
 * need an identity (saving a version, sharing a read-only link). Unfilled
 * placeholders block export — there is no honest file with blanks in it.
 */
export function ExportScreen({ doc, analysis, rewrite, versions, signedIn, providers }: { doc: ParsedResume; analysis: Analysis; rewrite: Rewrite; versions: VersionRecord[]; signedIn: boolean; providers: string[] }) {
  const accepted = useMemo(() => Object.fromEntries(rewrite.diffs.map((h) => [h.id, h.accepted])), [rewrite.diffs]);
  const values = useMemo(() => Object.fromEntries(rewrite.placeholders.filter((p) => p.value).map((p) => [p.id, p.value!])), [rewrite.placeholders]);
  const live = useLiveScore(doc, analysis, rewrite, accepted, values);
  const lines = useMemo(() => buildExportDoc(doc, rewrite, accepted, values), [doc, rewrite, accepted, values]);
  const blockers = useMemo(() => unfilledPlaceholders(lines), [lines]);
  const blocked = blockers.length > 0;
  const text = useMemo(() => exportText(lines), [lines]);
  const [busy, setBusy] = useState<string | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [saved, setSaved] = useState<VersionRecord[]>(versions);
  const toast = useToast();
  const stem = safeFileStem(doc.fileName);
  const original = analysis.overallScore ?? 0;

  const download = (bytes: Uint8Array | string, name: string, type: string) => {
    const blob = new Blob([bytes as BlobPart], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const run = async (kind: 'pdf' | 'docx' | 'txt') => {
    if (blocked) return;
    setBusy(kind);
    try {
      if (kind === 'txt') download(text, `${stem}-ats.txt`, 'text/plain;charset=utf-8');
      else if (kind === 'pdf') {
        const { exportPdf } = await import('@/lib/export/pdf');
        download(await exportPdf(lines), `${stem}-ats.pdf`, 'application/pdf');
      } else {
        const { exportDocx } = await import('@/lib/export/docx');
        download(await exportDocx(lines), `${stem}-ats.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      }
      toast({ title: `${kind.toUpperCase()} downloaded`, description: `Scores ${live.current.overallScore} with the same engine.`, tone: 'good' });
    } catch (err) {
      toast({ title: 'Export failed', description: (err as Error).message, tone: 'bad' });
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    setBusy('save');
    const res = await saveVersionAction(analysis.id, `Score ${live.current.overallScore}`, live.current.overallScore, live.projected.overallScore);
    setBusy(null);
    if (!res.ok) {
      if (res.needsAuth) {
        if (providers.length) window.location.href = `/auth/${providers[0]}?returnTo=${encodeURIComponent(location.pathname)}`;
        else toast({ title: 'Sign-in is not configured', description: 'Set AUTH_SECRET and a GitHub or Google OAuth app to enable saving. Anonymous runs stay for seven days.', tone: 'bad' });
      } else toast({ title: 'Could not save', description: res.error, tone: 'bad' });
      return;
    }
    setSaved((v) => [res.version, ...v]);
    toast({ title: 'Version saved', description: res.version.label, tone: 'good' });
  };
  const makeShare = async () => {
    setBusy('share');
    const { token } = await createShareAction(analysis.id);
    setBusy(null);
    const url = `${location.origin}/share/${token}`;
    setShare(url);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Read-only link copied', description: 'Anyone with the link can view the report for 30 days.', tone: 'good' });
    } catch {
      toast({ title: 'Read-only link ready', description: url });
    }
  };

  usePaletteCommands(
    'export',
    [
      { id: 'dl-pdf', label: 'Download PDF', group: 'Export', run: () => run('pdf') },
      { id: 'dl-docx', label: 'Download DOCX', group: 'Export', run: () => run('docx') },
      { id: 'dl-txt', label: 'Download plain text', group: 'Export', run: () => run('txt') },
      { id: 'share', label: 'Create read-only link', group: 'Export', run: makeShare },
    ],
    [blocked, lines],
  );

  return (
    <div className="flex flex-col">
      <FlowNav id={analysis.id} current="export" hasRewrite fileName={doc.fileName} score={analysis.overallScore} projected={live.projected.overallScore} />
      <div className="container-x grid grid-cols-1 gap-8 py-6 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-5">
          <section className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            <ScoreRing score={live.current.overallScore} size={188} label="final score" id="score-ring" />
            <div className="min-w-0 flex-1">
              <p className="t-label">Rewrite · {analysis.target.label}</p>
              <p className="mt-1 text-md text-fg">
                <span className="num">{original}</span> → <span className="num text-good">{live.current.overallScore}</span>
                {live.unfilledCount ? (
                  <span className="text-fg-2">
                    {' '}
                    · <span className="num">{live.projected.overallScore}</span> once filled
                  </span>
                ) : null}
              </p>
              <p className="mt-2 text-sm text-fg-1">Scored by the same six-category engine as the upload. Single column, no tables, no headers, standard headings.</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Readout label="gain" value={`+${live.current.overallScore - original}`} tone="good" />
                <Readout label="fill-ins" value={live.unfilledCount} tone={live.unfilledCount ? 'bad' : 'good'} />
                <Readout label="lines" value={lines.length} />
              </div>
            </div>
          </section>
          <EngineReadouts engines={live.current.perEngineScores} compare={analysis.perEngineScores} />
          <div className="panel p-4">
            <p className="t-label mb-2">Category scores</p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {live.current.categories.map((c) => {
                const before = analysis.categories.find((x) => x.id === c.id)?.score ?? 0;
                return (
                  <li key={c.id} className="readout">
                    <p className="t-label truncate">{CATEGORY_META[c.id].label}</p>
                    <p className="num mt-1 text-sm text-fg">
                      {c.score} <span className="text-xs text-fg-2">from {before}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-7">
          {blocked ? (
            <div role="alert" className="panel flex items-start gap-3 border-[rgba(242,179,61,0.4)] p-4">
              <IconAlert className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">
                  {blockers.length} fill-in field{blockers.length === 1 ? '' : 's'} still empty
                </p>
                <p className="mt-1 text-sm text-fg-1">Exporting would ship a resume with brackets in it. Fill them in on the rewrite screen, or reject the changes that need them.</p>
                <ul className="num mt-2 flex flex-wrap gap-1.5 text-xs">
                  {[...new Set(blockers)].slice(0, 8).map((b) => (
                    <li key={b} className="rounded-r0 border border-[rgba(242,179,61,0.4)] bg-accent-dim px-1.5 py-0.5 text-accent">
                      {b}
                    </li>
                  ))}
                  {blockers.length > 8 ? <li className="text-fg-2">+{blockers.length - 8} more</li> : null}
                </ul>
                <ButtonLink href={`/report/${analysis.id}/diff`} variant="primary" className="mt-3">
                  Fill them in
                </ButtonLink>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                ['pdf', 'PDF', 'Letter, Helvetica, real text. The format most portals expect.'],
                ['docx', 'DOCX', 'Word bullets and body paragraphs only. Editable.'],
                ['txt', 'Plain text', 'For pasting into forms that want raw text.'],
              ] as const
            ).map(([kind, label, blurb]) => (
              <button key={kind} type="button" onClick={() => run(kind)} disabled={blocked || busy !== null} className={cn('panel flex flex-col items-start gap-2 p-4 text-left transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-50')} aria-disabled={blocked}>
                <span className="flex w-full items-center justify-between">
                  <span className="t-label">{label}</span>
                  <IconDownload className="text-fg-2" />
                </span>
                <span className="text-sm text-fg-1">{blurb}</span>
                <span className="num text-xs text-fg-2">{busy === kind ? 'Generating…' : `${stem}-ats.${kind}`}</span>
              </button>
            ))}
          </div>
          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="t-label">Preview · exactly what the files contain</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  toast({ title: 'Copied', description: 'Plain text is on your clipboard.', tone: 'good' });
                }}
              >
                <IconCopy /> Copy text
              </Button>
            </div>
            <pre className="num mt-3 max-h-[440px] overflow-auto whitespace-pre-wrap rounded-r2 border border-line bg-bg p-3 text-xs leading-5 text-fg-1">{text}</pre>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="panel flex flex-col gap-3 p-4">
              <p className="t-label flex items-center gap-2">
                <IconHistory /> Versions
              </p>
              <p className="text-sm text-fg-1">{signedIn ? 'Saved versions stay for a year and can be compared in History.' : providers.length ? 'Sign in to keep versions past seven days. Your current runs come with you.' : 'Saving needs sign-in, which is not configured on this deployment. Runs stay for seven days.'}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={save} disabled={busy === 'save' || (!signedIn && providers.length === 0)}>
                  {signedIn ? 'Save this version' : 'Sign in to save'}
                </Button>
                <ButtonLink href="/history" variant="ghost">
                  History
                </ButtonLink>
              </div>
              {saved.length ? (
                <ul className="num flex flex-col gap-1 text-xs text-fg-1">
                  {saved.slice(0, 4).map((v) => (
                    <li key={v.id} className="flex justify-between">
                      <span>{v.label}</span>
                      <span className="text-fg-2">{new Date(v.createdAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="panel flex flex-col gap-3 p-4">
              <p className="t-label flex items-center gap-2">
                <IconLink /> Read-only report link
              </p>
              <p className="text-sm text-fg-1">Share the findings and scores. The link shows the report, not your file, and expires in 30 days.</p>
              <Button variant="secondary" onClick={makeShare} disabled={busy === 'share'}>
                {share ? 'Copy again' : 'Create link'}
              </Button>
              {share ? (
                <p className="num break-all text-xs text-fg-2" aria-live="polite">
                  {share}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
