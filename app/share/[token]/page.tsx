import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveShareToken, loadDoc, loadAnalysis } from '@/lib/store/analyses';
import { ReportScreen } from '@/components/report/report-screen';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const id = await resolveShareToken(token);
  const a = id ? await loadAnalysis(id) : null;
  return { title: a ? `Shared report · ${a.overallScore}` : 'Shared report', robots: { index: false } };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = await resolveShareToken(token);
  if (!id) notFound();
  const [rec, analysis] = await Promise.all([loadDoc(id), loadAnalysis(id)]);
  if (!rec || !analysis || analysis.status !== 'done') notFound();
  return (
    <div>
      <div className="border-b border-line bg-bg-1">
        <div className="container-x flex h-10 items-center gap-3 text-xs text-fg-1">
          <span className="t-label">Read-only</span>
          <span>Shared report for {analysis.fileName}. Findings, scores and the ATS view; no file, no editing.</span>
        </div>
      </div>
      <ReportScreen doc={rec.doc} analysis={analysis} rewrite={null} readOnly />
    </div>
  );
}
