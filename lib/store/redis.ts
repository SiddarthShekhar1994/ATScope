import { Redis } from '@upstash/redis';

/**
 * Key-value store. Upstash Redis when UPSTASH_REDIS_REST_URL/TOKEN are set;
 * otherwise an in-process map so local development works with no services.
 * The interface is the small subset we use, so swapping backends is trivial.
 */
export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  lpush(key: string, value: string, ttlSeconds?: number): Promise<void>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
  readonly backend: 'upstash' | 'memory';
}

class MemoryKV implements KV {
  readonly backend = 'memory' as const;
  private data = new Map<string, { value: unknown; expires?: number }>();
  private lists = new Map<string, { value: string[]; expires?: number }>();
  private live<T extends { expires?: number }>(map: Map<string, T>, key: string): T | undefined {
    const row = map.get(key);
    if (!row) return undefined;
    if (row.expires && row.expires < Date.now()) {
      map.delete(key);
      return undefined;
    }
    return row;
  }
  async get<T>(key: string): Promise<T | null> {
    return (this.live(this.data, key)?.value as T) ?? null;
  }
  async set<T>(key: string, value: T, ttl?: number) {
    this.data.set(key, { value, expires: ttl ? Date.now() + ttl * 1000 : undefined });
  }
  async del(key: string) {
    this.data.delete(key);
    this.lists.delete(key);
  }
  async lpush(key: string, value: string, ttl?: number) {
    const row = this.live(this.lists, key) ?? { value: [] as string[] };
    row.value.unshift(value);
    row.expires = ttl ? Date.now() + ttl * 1000 : row.expires;
    this.lists.set(key, row);
  }
  async lrange(key: string, start: number, stop: number) {
    const row = this.live(this.lists, key);
    if (!row) return [];
    return row.value.slice(start, stop === -1 ? undefined : stop + 1);
  }
  async incr(key: string, ttl?: number) {
    const cur = ((await this.get<number>(key)) ?? 0) + 1;
    await this.set(key, cur, ttl);
    return cur;
  }
}

class UpstashKV implements KV {
  readonly backend = 'upstash' as const;
  constructor(private redis: Redis) {}
  async get<T>(key: string) {
    return (await this.redis.get<T>(key)) ?? null;
  }
  async set<T>(key: string, value: T, ttl?: number) {
    if (ttl) await this.redis.set(key, value, { ex: ttl });
    else await this.redis.set(key, value);
  }
  async del(key: string) {
    await this.redis.del(key);
  }
  async lpush(key: string, value: string, ttl?: number) {
    await this.redis.lpush(key, value);
    if (ttl) await this.redis.expire(key, ttl);
  }
  async lrange(key: string, start: number, stop: number) {
    return (await this.redis.lrange<string>(key, start, stop)) ?? [];
  }
  async incr(key: string, ttl?: number) {
    const n = await this.redis.incr(key);
    if (n === 1 && ttl) await this.redis.expire(key, ttl);
    return n;
  }
}

declare global {
  var __atscopeKV: KV | undefined;
}

/**
 * Upstash REST credentials. A database created on upstash.com names them
 * UPSTASH_REDIS_REST_*; Vercel's Upstash integration names them KV_REST_API_*.
 */
export function upstashCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function kv(): KV {
  if (globalThis.__atscopeKV) return globalThis.__atscopeKV;
  const creds = upstashCredentials();
  if (!creds && process.env.NODE_ENV === 'production') {
    console.warn('[kv] No Upstash credentials, using the in-memory store. That only works on a single long-running server; on Vercel or any serverless host, uploads and sessions will go missing between requests.');
  }
  globalThis.__atscopeKV = creds ? new UpstashKV(new Redis(creds)) : new MemoryKV();
  return globalThis.__atscopeKV;
}

export const TTL = {
  anonymous: 7 * 24 * 3600,
  saved: 365 * 24 * 3600,
  share: 30 * 24 * 3600,
};
