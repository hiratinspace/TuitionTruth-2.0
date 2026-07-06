"use client";

import { useEffect } from "react";
import { Button, Card } from "@tuitiontruth/ui";

/**
 * Route-level error boundary (App Router). Catches render/data errors in a
 * segment and offers recovery without a full reload. The technical detail is
 * logged, never shown — users see a calm, on-brand message.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col items-center justify-center px-6 py-10">
      <Card className="max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Something went wrong</h1>
        <p className="mt-3 font-body text-sm leading-relaxed text-ink/70">
          We hit an unexpected error loading this data. Your request wasn&rsquo;t completed — no
          numbers here should be trusted until the page loads cleanly.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => (window.location.href = "/")}>
            Go home
          </Button>
        </div>
        {error.digest !== undefined && (
          <p className="mt-4 font-data text-xs text-ink/40">Reference: {error.digest}</p>
        )}
      </Card>
    </main>
  );
}
