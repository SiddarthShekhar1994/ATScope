import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { loadDoc, loadAnalysis, loadRewrite, listVersions } from '@/lib/store/analyses';
import { currentUser, authProviders } from '@/lib/auth/session';
import { ExportScreen } from '@/components/export/export-screen';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Export' };

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rec, analysis, rewrite, versions, user] = await Promise.all([loadDoc(id), loadAnalysis(id), loadRewrite(id), listVersions(id), currentUser()]);
  if (!rec) notFound();
  if (!analysis || analysis.status !== 'done') redirect(`/analyze/${id}`);
  if (!rewrite) redirect(`/report/${id}/plan`);
  return <ExportScreen doc={rec.doc} analysis={analysis} rewrite={rewrite} versions={versions} signedIn={!!user} providers={authProviders()} />;
}
