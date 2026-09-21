import type { User } from './session';

/**
 * Hand-rolled OAuth 2.0 authorization-code flow for GitHub and Google. Small
 * enough to read in one sitting, no library, no database: the callback signs a
 * cookie and the user's analyses get claimed under that id.
 */
export interface ProviderConfig {
  id: 'github' | 'google';
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
  profile(accessToken: string): Promise<User>;
}

export function providerConfig(id: string, origin: string): ProviderConfig | null {
  void origin;
  if (id === 'github' && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    return {
      id: 'github',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scope: 'read:user user:email',
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      async profile(token) {
        const res = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'atscope' } });
        if (!res.ok) throw new Error(`GitHub profile failed: ${res.status}`);
        const u = (await res.json()) as { id: number; login: string; name?: string; email?: string; avatar_url?: string };
        return { id: `github:${u.id}`, name: u.name ?? u.login, email: u.email ?? undefined, avatar: u.avatar_url, provider: 'github' };
      },
    };
  }
  if (id === 'google' && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    return {
      id: 'google',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scope: 'openid email profile',
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      async profile(token) {
        const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Google profile failed: ${res.status}`);
        const u = (await res.json()) as { sub: string; name?: string; email?: string; picture?: string };
        return { id: `google:${u.sub}`, name: u.name, email: u.email, avatar: u.picture, provider: 'google' };
      },
    };
  }
  return null;
}

export async function exchangeCode(cfg: ProviderConfig, code: string, redirectUri: string): Promise<string> {
  const body = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  const res = await fetch(cfg.tokenUrl, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error ?? 'No access token returned');
  return data.access_token;
}
