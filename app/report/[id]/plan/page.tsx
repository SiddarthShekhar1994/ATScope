import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loadDoc, loadAnalysis, loadRewrite } from '@/lib/store/analyses';
import { PlanScreen } from '@/components/plan/plan-screen';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Plan' };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rec, analysis, rewrite] = await Promise.all([loadDoc(id), loadAnalysis(id), loadRewrite(id)]);
  if (!rec) notFound();
  if (!analysis || analysis.status !== 'done') redirect(`/analyze/${id}`);
  return <PlanScreen doc={rec.doc} analysis={analysis} rewrite={rewrite} />;
}
