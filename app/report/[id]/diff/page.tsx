import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loadDoc, loadAnalysis, loadRewrite } from '@/lib/store/analyses';
import { DiffScreen } from '@/components/diff/diff-screen';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rewrite' };

export default async function DiffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rec, analysis, rewrite] = await Promise.all([loadDoc(id), loadAnalysis(id), loadRewrite(id)]);
  if (!rec) notFound();
  if (!analysis || analysis.status !== 'done') redirect(`/analyze/${id}`);
  if (!rewrite) redirect(`/report/${id}/plan`);
  return <DiffScreen doc={rec.doc} analysis={analysis} rewrite={rewrite} />;
}
