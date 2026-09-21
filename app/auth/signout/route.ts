import { NextResponse, type NextRequest } from 'next/server';
import { USER_COOKIE } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL(req.nextUrl.searchParams.get('returnTo') ?? '/', req.nextUrl.origin), { status: 303 });
  res.cookies.delete(USER_COOKIE);
  return res;
}
