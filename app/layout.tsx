import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, JetBrains_Mono } from 'next/font/google';
import { ViewTransitions } from 'next-view-transitions';
import './globals.css';
import { Providers } from '@/components/providers';
import { SiteHeader } from '@/components/site-header';
import { currentUser, authProviders } from '@/lib/auth/session';

const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans', display: 'swap' });
const display = IBM_Plex_Sans_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ATScope', template: '%s · ATScope' },
  description: 'See your resume the way an applicant tracking system reads it. Honest score, line-by-line teardown, truthful rewrite.',
  applicationName: 'ATScope',
};

export const viewport: Viewport = {
  themeColor: '#121110',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, providers] = await Promise.all([currentUser(), Promise.resolve(authProviders())]);
  return (
    <ViewTransitions>
      <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
        <body className="min-h-dvh bg-bg text-fg antialiased">
          <Providers>
            <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-r2 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
              Skip to content
            </a>
            <SiteHeader user={user} providers={providers} />
            <main id="main" className="min-h-[calc(100dvh-56px)]">
              {children}
            </main>
          </Providers>
        </body>
      </html>
    </ViewTransitions>
  );
}
