import type { Metadata } from 'next';
import { listHistory, loadAnalysis, listUserAnalyses } from '@/lib/store/analyses';
import { peekSessionId } from '@/lib/store/session';
import { currentUser } from '@/lib/auth/session';
import { HistoryScreen } from '@/components/history/history-screen';
import type { Analysis } from '@/lib/schema/analysis';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'History' };

export default async function HistoryPage() {
  const [sid, user] = await Promise.all([peekSessionId(), currentUser()]);
  const entries = sid ? await listHistory(sid) : [];
  if (user) {
    const ids = await listUserAnalyses(user.id);
    for (const id of ids) {
      if (entries.some((e) => e.id === id)) continue;
      const a = await loadAnalysis(id);
      if (a) entries.push({ id, fileName: a.fileName, createdAt: a.startedAt, score: a.overallScore, targetLabel: a.target.label });
    }
  }
  const analyses: Record<string, Analysis | null> = {};
  await Promise.all(entries.map(async (e) => (analyses[e.id] = await loadAnalysis(e.id))));
  return <HistoryScreen entries={entries} analyses={analyses} />;
}
