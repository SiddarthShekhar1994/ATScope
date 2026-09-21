import { cookies, headers } from 'next/headers';
import { randomUUID } from 'node:crypto';

/**
 * Anonymous sessions: an httpOnly cookie minted on first use. No signup.
 * A signed-in user (see lib/auth) gets a second cookie; the session id stays
 * so history carries over when someone signs in to save.
 */
export const SESSION_COOKIE = 'ats_sid';

export async function getSessionId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const id = randomUUID();
  try {
    jar.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
  } catch {
    // Cookies can only be set inside a Server Action or Route Handler; in a
    // Server Component render we fall back to a per-request id.
  }
  return id;
}

export async function peekSessionId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}
