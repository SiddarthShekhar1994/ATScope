import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { loadDoc, loadAnalysis, loadRewrite } from '@/lib/store/analyses';
import { ReportScreen } from '@/components/report/report-screen';
import { CategorySkeleton } from '@/components/report/category-bars';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const a = await loadAnalysis(id);
  return { title: a ? `${a.overallScore ?? '—'} · ${a.fileName}` : 'Report' };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rec, analysis, rewrite] = await Promise.all([loadDoc(id), loadAnalysis(id), loadRewrite(id)]);
  if (!rec) notFound();
  if (!analysis || analysis.status !== 'done') redirect(`/analyze/${id}`);
  return (
    <Suspense
      fallback={
        <div className="container-x py-6">
          <CategorySkeleton />
        </div>
      }
    >
      <ReportScreen doc={rec.doc} analysis={analysis} rewrite={rewrite} />
    </Suspense>
  );
}
