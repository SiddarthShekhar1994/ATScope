import { NextResponse, type NextRequest } from 'next/server';
import { providerConfig, exchangeCode } from '@/lib/auth/oauth';
import { signUser, USER_COOKIE } from '@/lib/auth/session';
import { SESSION_COOKIE } from '@/lib/store/session';
import { listHistory, claimForUser } from '@/lib/store/analyses';

/** Step 2: verify state, exchange the code, sign the user cookie, claim this session's analyses. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const origin = req.nextUrl.origin;
  const cfg = providerConfig(provider, origin);
  const raw = req.cookies.get('ats_oauth')?.value;
  const saved = raw ? (JSON.parse(raw) as { state: string; returnTo: string }) : null;
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!cfg || !code || !saved || saved.state !== state) return NextResponse.redirect(new URL('/?auth=failed', origin));
  try {
    const token = await exchangeCode(cfg, code, `${origin}/auth/${cfg.id}/callback`);
    const user = await cfg.profile(token);
    const signed = signUser(user);
    if (!signed) return NextResponse.redirect(new URL('/?auth=unconfigured', origin));
    const sid = req.cookies.get(SESSION_COOKIE)?.value;
    if (sid) {
      const history = await listHistory(sid);
      await Promise.all(history.map((h) => claimForUser(h.id, user.id)));
    }
    const res = NextResponse.redirect(new URL(saved.returnTo || '/', origin));
    res.cookies.set(USER_COOKIE, signed, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 90 * 24 * 3600, secure: process.env.NODE_ENV === 'production' });
    res.cookies.delete('ats_oauth');
    return res;
  } catch (err) {
    console.error('[auth]', err);
    return NextResponse.redirect(new URL('/?auth=failed', origin));
  }
}
