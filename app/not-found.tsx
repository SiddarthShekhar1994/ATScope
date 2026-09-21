import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container-x flex min-h-[60dvh] flex-col items-start justify-center gap-4 py-16">
      <p className="t-label">404</p>
      <h1 className="t-display text-3xl text-fg">Nothing here, or it expired.</h1>
      <p className="max-w-md text-fg-1">Anonymous analyses are kept for seven days. Scan the file again to get a fresh report.</p>
      <ButtonLink href="/upload" variant="primary">
        Scan a resume
      </ButtonLink>
    </div>
  );
}
