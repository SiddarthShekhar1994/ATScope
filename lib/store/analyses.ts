import { kv, TTL } from './redis';
import type { ParsedResume } from '../parse/types';
import type { Analysis } from '../schema/analysis';
import type { Rewrite } from '../schema/rewrite';

/**
 * Persistence for one analysis run:
 *   doc:{id}       the parsed upload (lines with geometry, sections, ATS view)
 *   analysis:{id}  the streamed Analysis object, saved once complete
 *   rewrite:{id}   the latest Rewrite state (accept/reject flags, placeholder values)
 *   versions:{id}  ids of saved snapshots; version:{vid} the snapshot
 *   history:{sid}  analysis ids for an anonymous session
 *   share:{token}  read-only link → analysis id
 */

export interface DocRecord {
  id: string;
  ownerSid: string;
  ownerUid?: string;
  createdAt: number;
  jd?: string;
  roleId?: string;
  doc: ParsedResume;
}

export interface HistoryEntry {
  id: string;
  fileName: string;
  createdAt: number;
  score?: number;
  rewriteScore?: number;
  targetLabel?: string;
}

export interface VersionRecord {
  id: string;
  analysisId: string;
  createdAt: number;
  label: string;
  score: number;
  projectedScore: number;
  text: string;
  rewrite: Rewrite;
}

const ttlFor = (rec: { ownerUid?: string }) => (rec.ownerUid ? TTL.saved : TTL.anonymous);

export async function saveDoc(rec: DocRecord): Promise<void> {
  await kv().set(`doc:${rec.id}`, rec, ttlFor(rec));
  await kv().lpush(`history:${rec.ownerSid}`, rec.id, TTL.anonymous);
}

export async function loadDoc(id: string): Promise<DocRecord | null> {
  return kv().get<DocRecord>(`doc:${id}`);
}

export async function saveAnalysis(a: Analysis, owner: { ownerUid?: string }): Promise<void> {
  await kv().set(`analysis:${a.id}`, a, ttlFor(owner));
}

export async function loadAnalysis(id: string): Promise<Analysis | null> {
  return kv().get<Analysis>(`analysis:${id}`);
}

export async function saveRewrite(r: Rewrite, owner: { ownerUid?: string }): Promise<void> {
  await kv().set(`rewrite:${r.analysisId}`, r, ttlFor(owner));
}

export async function loadRewrite(analysisId: string): Promise<Rewrite | null> {
  return kv().get<Rewrite>(`rewrite:${analysisId}`);
}

export async function saveVersion(v: VersionRecord, owner: { ownerUid?: string }): Promise<void> {
  await kv().set(`version:${v.id}`, v, ttlFor(owner));
  await kv().lpush(`versions:${v.analysisId}`, v.id, ttlFor(owner));
}

export async function listVersions(analysisId: string): Promise<VersionRecord[]> {
  const ids = await kv().lrange(`versions:${analysisId}`, 0, 49);
  const rows = await Promise.all(ids.map((id) => kv().get<VersionRecord>(`version:${id}`)));
  return rows.filter((r): r is VersionRecord => !!r);
}

export async function loadVersion(id: string): Promise<VersionRecord | null> {
  return kv().get<VersionRecord>(`version:${id}`);
}

export async function listHistory(sid: string): Promise<HistoryEntry[]> {
  const ids = await kv().lrange(`history:${sid}`, 0, 29);
  const rows = await Promise.all(
    ids.map(async (id) => {
      const [doc, analysis, rewrite] = await Promise.all([loadDoc(id), loadAnalysis(id), loadRewrite(id)]);
      if (!doc) return null;
      return { id, fileName: doc.doc.fileName, createdAt: doc.createdAt, score: analysis?.overallScore, rewriteScore: rewrite?.projected?.overallScore, targetLabel: analysis?.target.label } as HistoryEntry;
    }),
  );
  return rows.filter((r): r is HistoryEntry => !!r);
}

export async function createShareToken(analysisId: string, token: string): Promise<void> {
  await kv().set(`share:${token}`, analysisId, TTL.share);
}

export async function resolveShareToken(token: string): Promise<string | null> {
  return kv().get<string>(`share:${token}`);
}

export async function claimForUser(analysisId: string, uid: string): Promise<void> {
  const rec = await loadDoc(analysisId);
  if (!rec) return;
  rec.ownerUid = uid;
  await kv().set(`doc:${rec.id}`, rec, TTL.saved);
  await kv().lpush(`user:${uid}:analyses`, analysisId, TTL.saved);
  const [a, r] = await Promise.all([loadAnalysis(analysisId), loadRewrite(analysisId)]);
  if (a) await kv().set(`analysis:${analysisId}`, a, TTL.saved);
  if (r) await kv().set(`rewrite:${analysisId}`, r, TTL.saved);
}

export async function listUserAnalyses(uid: string): Promise<string[]> {
  return kv().lrange(`user:${uid}:analyses`, 0, 49);
}
