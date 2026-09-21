'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { IconAlert } from '@/components/ui/icons';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[app]', error);
  }, [error]);
  return (
    <div className="container-x flex min-h-[60dvh] flex-col items-start justify-center gap-4 py-16">
      <p className="t-label flex items-center gap-2 text-bad">
        <IconAlert /> Something broke
      </p>
      <h1 className="t-display text-3xl text-fg">That did not go to plan.</h1>
      <p className="max-w-md text-fg-1">{error.message || 'An unexpected error occurred.'}</p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" variant="ghost">
          Back to start
        </ButtonLink>
      </div>
    </div>
  );
}
