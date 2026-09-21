'use server';

import { createStreamableValue } from '@ai-sdk/rsc';
import { randomUUID } from 'node:crypto';
import { parseResumeFile, ParseError, MAX_FILE_BYTES, type ParsedResume } from '@/lib/parse';
import { saveDoc, loadDoc, saveAnalysis, loadAnalysis, saveRewrite, loadRewrite, listHistory, saveVersion, listVersions, createShareToken, type HistoryEntry, type VersionRecord } from '@/lib/store/analyses';
import { getSessionId, clientIp } from '@/lib/store/session';
import { enforceLimit, RateLimitError } from '@/lib/store/ratelimit';
import { resolveModel } from '@/lib/ai/model';
import { runAnalysis } from '@/lib/analysis/pipeline';
import { runRewrite } from '@/lib/rewrite/rewriter';
import { composeDocument } from '@/lib/rewrite/compose';
import type { AnalysisEvent, Analysis } from '@/lib/schema/analysis';
import type { RewriteEvent, Rewrite } from '@/lib/schema/rewrite';
import { currentUser } from '@/lib/auth/session';

export type UploadResult = { ok: true; id: string; doc: ParsedResume } | { ok: false; error: string; code: string };

export async function uploadResume(formData: FormData): Promise<UploadResult> {
  const sid = await getSessionId();
  try {
    await enforceLimit('upload', sid);
  } catch (err) {
    if (err instanceof RateLimitError) return { ok: false, error: err.message, code: 'rate-limit' };
    throw err;
  }
  const file = formData.get('file');
  if (!(file instanceof File)) return { ok: false, error: 'No file received.', code: 'empty' };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'That file is over 8 MB. Export a lighter PDF.', code: 'too-large' };
  const jd = String(formData.get('jd') ?? '').slice(0, 20000) || undefined;
  const roleId = String(formData.get('roleId') ?? '') || undefined;
  const id = randomUUID().slice(0, 12);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const doc = await parseResumeFile(bytes, file.name, id);
    const user = await currentUser();
    await saveDoc({ id, ownerSid: sid, ownerUid: user?.id, createdAt: Date.now(), jd, roleId, doc });
    return { ok: true, id, doc };
  } catch (err) {
    if (err instanceof ParseError) return { ok: false, error: err.message, code: err.code };
    console.error('[upload]', err);
    return { ok: false, error: 'Something went wrong while reading the file.', code: 'unknown' };
  }
}

export async function startAnalysis(id: string) {
  const sid = await getSessionId();
  const rec = await loadDoc(id);
  if (!rec) return { error: 'This analysis has expired or does not exist.' as const };
  try {
    await enforceLimit('analyze', `${sid}:${await clientIp()}`);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }
  const streamable = createStreamableValue<AnalysisEvent>();
  const model = resolveModel();
  void (async () => {
    try {
      const gen = runAnalysis(rec.doc, { jd: rec.jd, roleId: rec.roleId, model });
      let final: Analysis | undefined;
      for (;;) {
        const step = await gen.next();
        if (step.done) {
          final = step.value;
          break;
        }
        streamable.update(step.value);
      }
      if (final) await saveAnalysis(final, { ownerUid: rec.ownerUid });
      streamable.done();
    } catch (err) {
      console.error('[analysis]', err);
      streamable.update({ type: 'error', message: (err as Error).message || 'Analysis failed.', at: Date.now() });
      streamable.done();
    }
  })();
  return { stream: streamable.value, modelAvailable: model.available, modelSpec: model.spec };
}

export async function startRewrite(id: string, enabledPlanItemIds: string[]) {
  const sid = await getSessionId();
  const [rec, analysis] = await Promise.all([loadDoc(id), loadAnalysis(id)]);
  if (!rec || !analysis) return { error: 'This analysis has expired or does not exist.' as const };
  try {
    await enforceLimit('rewrite', `${sid}:${await clientIp()}`);
  } catch (err) {
    if (err instanceof RateLimitError) return { error: err.message };
    throw err;
  }
  const streamable = createStreamableValue<RewriteEvent>();
  const model = resolveModel();
  void (async () => {
    try {
      const gen = runRewrite(rec.doc, analysis, enabledPlanItemIds, { model });
      let final: Rewrite | undefined;
      for (;;) {
        const step = await gen.next();
        if (step.done) {
          final = step.value;
          break;
        }
        streamable.update(step.value);
      }
      if (final) await saveRewrite(final, { ownerUid: rec.ownerUid });
      streamable.done();
    } catch (err) {
      console.error('[rewrite]', err);
      streamable.update({ type: 'error', message: (err as Error).message || 'Rewrite failed.', at: Date.now() });
      streamable.done();
    }
  })();
  return { stream: streamable.value, modelAvailable: model.available, modelSpec: model.spec };
}

/** Persist accept/reject flags and placeholder values so a reload keeps the user's work. */
export async function persistRewriteState(id: string, patch: { accepted: Record<string, boolean>; placeholders: Record<string, string> }) {
  const [rec, rewrite] = await Promise.all([loadDoc(id), loadRewrite(id)]);
  if (!rec || !rewrite) return { ok: false as const };
  const next: Rewrite = {
    ...rewrite,
    diffs: rewrite.diffs.map((h) => (h.id in patch.accepted ? { ...h, accepted: patch.accepted[h.id] } : h)),
    placeholders: rewrite.placeholders.map((p) => (p.id in patch.placeholders ? { ...p, value: patch.placeholders[p.id] } : p)),
  };
  await saveRewrite(next, { ownerUid: rec.ownerUid });
  return { ok: true as const };
}

export async function saveVersionAction(id: string, label: string, score: number, projectedScore: number): Promise<{ ok: true; version: VersionRecord } | { ok: false; error: string; needsAuth?: boolean }> {
  const user = await currentUser();
  if (!user) return { ok: false, error: 'Sign in to save versions.', needsAuth: true };
  const [rec, rewrite] = await Promise.all([loadDoc(id), loadRewrite(id)]);
  if (!rec || !rewrite) return { ok: false, error: 'Nothing to save yet.' };
  const composed = composeDocument({ lines: rewrite.lines, diffs: rewrite.diffs, placeholders: rewrite.placeholders, originalText: Object.fromEntries(rec.doc.lines.map((l) => [l.id, l.text])) });
  const version: VersionRecord = { id: randomUUID().slice(0, 10), analysisId: id, createdAt: Date.now(), label: label.slice(0, 80) || `Version ${new Date().toLocaleString()}`, score, projectedScore, text: composed.text, rewrite };
  await saveVersion(version, { ownerUid: user.id });
  return { ok: true, version };
}

export async function listVersionsAction(id: string): Promise<VersionRecord[]> {
  return listVersions(id);
}

export async function historyAction(): Promise<HistoryEntry[]> {
  const sid = await getSessionId();
  return listHistory(sid);
}

export async function createShareAction(id: string): Promise<{ token: string }> {
  const token = randomUUID().replace(/-/g, '').slice(0, 16);
  await createShareToken(id, token);
  return { token };
}
