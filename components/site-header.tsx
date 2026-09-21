'use client';

import { Link } from 'next-view-transitions';
import { usePathname } from 'next/navigation';
import type { User } from '@/lib/auth/session';
import { Kbd } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';

/**
 * A thin instrument bar. Wordmark, two links, the palette hint, and the sign-in
 * affordance only when a provider is actually configured.
 */
export function SiteHeader({ user, providers }: { user: User | null; providers: ('github' | 'google')[] }) {
  const pathname = usePathname();
  const inFlow = /^\/(analyze|report)\//.test(pathname);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[rgba(18,17,16,0.86)] backdrop-blur-md">
      <div className="container-x flex h-14 items-center justify-between gap-4">
        <Link href="/" className="hit flex items-center gap-2.5 rounded-r1 text-fg">
          <span aria-hidden className="relative inline-flex h-5 w-5 items-center justify-center rounded-r0 border border-line-strong bg-bg-2">
            <span className="absolute inset-x-0.5 top-1/2 h-px -translate-y-1/2 bg-accent shadow-[0_0_6px_var(--accent)]" />
          </span>
          <span className="t-display text-lg leading-none tracking-tight">ATScope</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
          <Link href="/upload" className={cn('hit rounded-r2 px-3 py-2 text-fg-1 hover:bg-bg-2 hover:text-fg', pathname === '/upload' && 'text-fg')}>
            Scan
          </Link>
          <Link href="/history" className={cn('hit rounded-r2 px-3 py-2 text-fg-1 hover:bg-bg-2 hover:text-fg', pathname === '/history' && 'text-fg')}>
            History
          </Link>
          <button type="button" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))} className="hidden items-center gap-1.5 rounded-r2 px-3 py-2 text-fg-2 hover:bg-bg-2 hover:text-fg md:inline-flex" aria-label="Open command palette">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </button>
          {user ? (
            <form action={`/auth/signout?returnTo=${encodeURIComponent(pathname)}`} method="post" className="ml-2 flex items-center gap-2">
              <span className="hidden text-xs text-fg-2 sm:inline">{user.name ?? user.email}</span>
              <button type="submit" className="hit rounded-r2 border border-line px-3 py-1.5 text-xs text-fg-1 hover:bg-bg-2 hover:text-fg">
                Sign out
              </button>
            </form>
          ) : providers.length && !inFlow ? (
            <a href={`/auth/${providers[0]}?returnTo=${encodeURIComponent(pathname)}`} className="hit ml-2 rounded-r2 border border-line px-3 py-1.5 text-xs text-fg-1 hover:bg-bg-2 hover:text-fg">
              Sign in
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
