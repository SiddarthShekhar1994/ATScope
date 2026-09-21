import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * Model selection is one env var: AI_MODEL="provider/model-id".
 *   anthropic/claude-opus-5   (default; needs ANTHROPIC_API_KEY)
 *   openai/gpt-5              (needs OPENAI_API_KEY)
 *   any "provider/model" string routed through the Vercel AI Gateway when AI_GATEWAY_API_KEY is set
 * Without a key the app still runs: analysis is deterministic and the rewrite
 * uses the rule-based pass, clearly labelled as such.
 */
export const DEFAULT_MODEL = 'anthropic/claude-opus-5';

export interface ModelInfo {
  model: LanguageModel | null;
  spec: string;
  provider: string;
  available: boolean;
  reason?: string;
}

export function resolveModel(): ModelInfo {
  const spec = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
  const slash = spec.indexOf('/');
  const provider = slash === -1 ? 'gateway' : spec.slice(0, slash);
  const id = slash === -1 ? spec : spec.slice(slash + 1);
  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) return { model: null, spec, provider, available: false, reason: 'ANTHROPIC_API_KEY is not set' };
    return { model: createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(id), spec, provider, available: true };
  }
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) return { model: null, spec, provider, available: false, reason: 'OPENAI_API_KEY is not set' };
    return { model: createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id), spec, provider, available: true };
  }
  if (process.env.AI_GATEWAY_API_KEY) return { model: spec, spec, provider, available: true };
  return { model: null, spec, provider, available: false, reason: 'No API key for the configured provider' };
}

/** Provider options that make Claude think adaptively; harmless for other providers. */
export function providerOptions(spec: string) {
  return spec.startsWith('anthropic/') || spec.startsWith('claude') ? { anthropic: { thinking: { type: 'adaptive' as const } } } : undefined;
}
