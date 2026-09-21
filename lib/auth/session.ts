import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal signed-cookie sessions for the one thing that needs an identity:
 * saving versions past the anonymous 7-day window. OAuth providers are wired in
 * lib/auth/oauth.ts and only appear when their env vars exist.
 */
export const USER_COOKIE = 'ats_user';

export interface User {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
  provider: 'github' | 'google';
}

function secret(): string | null {
  return process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16 ? process.env.AUTH_SECRET : null;
}

export function signUser(user: User): string | null {
  const s = secret();
  if (!s) return null;
  const payload = Buffer.from(JSON.stringify({ ...user, iat: Date.now() })).toString('base64url');
  const sig = createHmac('sha256', s).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyUser(token: string | undefined): User | null {
  const s = secret();
  if (!s || !token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', s).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as User & { iat: number };
    if (Date.now() - data.iat > 90 * 24 * 3600 * 1000) return null;
    return { id: data.id, name: data.name, email: data.email, avatar: data.avatar, provider: data.provider };
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  return verifyUser(jar.get(USER_COOKIE)?.value);
}

export function authProviders(): ('github' | 'google')[] {
  const out: ('github' | 'google')[] = [];
  if (secret() && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) out.push('github');
  if (secret() && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) out.push('google');
  return out;
}
