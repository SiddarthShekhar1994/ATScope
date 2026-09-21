'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { IconAlert } from '@/components/ui/icons';

export default function ReportError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[report]', error);
  }, [error]);
  return (
    <div className="container-x py-10">
      <div className="panel mx-auto max-w-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-bad">
            <IconAlert />
          </span>
          <div>
            <p className="t-label">Report error</p>
            <h1 className="mt-1 text-md font-semibold text-fg">This report could not be rendered.</h1>
            <p className="mt-2 text-sm text-fg-1">{error.message || 'Something went wrong while loading the analysis.'}</p>
            {error.digest ? <p className="num mt-1 text-xs text-fg-3">ref {error.digest}</p> : null}
            <div className="mt-4 flex gap-2">
              <Button variant="primary" onClick={reset}>
                Try again
              </Button>
              <ButtonLink href="/upload" variant="ghost">
                Scan a different file
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
