import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { kv, upstashCredentials } from './redis';

/**
 * Sliding-window limits on the expensive operations. With Upstash configured we
 * use @upstash/ratelimit; without it, a fixed window on the in-memory store.
 */
export type LimitKind = 'analyze' | 'rewrite' | 'upload';

const LIMITS: Record<LimitKind, { requests: number; windowSeconds: number }> = {
  upload: { requests: 30, windowSeconds: 3600 },
  analyze: { requests: 20, windowSeconds: 3600 },
  rewrite: { requests: 10, windowSeconds: 3600 },
};

export class RateLimitError extends Error {
  constructor(
    public readonly kind: LimitKind,
    public readonly retryAfterSeconds: number,
  ) {
    super(`Too many ${kind} requests. Try again in about ${Math.ceil(retryAfterSeconds / 60)} minutes.`);
  }
}

const limiters: Partial<Record<LimitKind, Ratelimit>> = {};

export async function enforceLimit(kind: LimitKind, identity: string): Promise<void> {
  const cfg = LIMITS[kind];
  const creds = upstashCredentials();
  if (creds) {
    limiters[kind] ??= new Ratelimit({ redis: new Redis(creds), limiter: Ratelimit.slidingWindow(cfg.requests, `${cfg.windowSeconds} s`), prefix: `atscope:rl:${kind}` });
    const res = await limiters[kind]!.limit(identity);
    if (!res.success) throw new RateLimitError(kind, Math.max(1, Math.round((res.reset - Date.now()) / 1000)));
    return;
  }
  const bucket = Math.floor(Date.now() / 1000 / cfg.windowSeconds);
  const n = await kv().incr(`rl:${kind}:${identity}:${bucket}`, cfg.windowSeconds);
  if (n > cfg.requests) throw new RateLimitError(kind, cfg.windowSeconds - (Math.floor(Date.now() / 1000) % cfg.windowSeconds));
}
