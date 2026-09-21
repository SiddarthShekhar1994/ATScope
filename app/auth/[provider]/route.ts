import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { providerConfig } from '@/lib/auth/oauth';

/** Step 1: redirect to the provider with a state nonce stored in a short-lived cookie. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = req.nextUrl.origin;
  const cfg = providerConfig(provider, origin);
  if (!cfg) return NextResponse.redirect(new URL('/?auth=unavailable', origin));
  const state = randomBytes(16).toString('hex');
  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? '/';
  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', `${origin}/auth/${cfg.id}/callback`);
  url.searchParams.set('scope', cfg.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  const res = NextResponse.redirect(url);
  res.cookies.set('ats_oauth', JSON.stringify({ state, returnTo: returnTo.startsWith('/') ? returnTo : '/' }), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600, secure: process.env.NODE_ENV === 'production' });
  return res;
}
