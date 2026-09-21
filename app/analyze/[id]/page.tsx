import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loadDoc, loadAnalysis } from '@/lib/store/analyses';
import { emptyAnalysis } from '@/lib/analysis/pipeline';
import { buildContext } from '@/lib/score';
import { AnalyzeLive } from '@/components/analyze/analyze-live';

export const metadata: Metadata = { title: 'Analyzing' };
export const dynamic = 'force-dynamic';

export default async function AnalyzePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ rerun?: string }> }) {
  const { id } = await params;
  const { rerun } = await searchParams;
  const rec = await loadDoc(id);
  if (!rec) notFound();
  const existing = await loadAnalysis(id);
  if (existing && existing.status === 'done' && !rerun) redirect(`/report/${id}`);
  const ctx = buildContext(rec.doc, { jd: rec.jd, roleId: rec.roleId });
  const seed = emptyAnalysis(rec.doc, { label: ctx.targetLabel, source: ctx.targetSource, roleId: ctx.roleId, jdText: ctx.jdText });
  return (
    <div className="container-x py-6">
      <AnalyzeLive doc={rec.doc} seed={seed} />
    </div>
  );
}
