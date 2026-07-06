import { Card, Skeleton } from "@tuitiontruth/ui";

/**
 * Route-level skeleton. Mirrors the profile layout exactly (§3.3) — header,
 * headline block, chart bones, five stat cards — so the shell streams instantly
 * and hydration causes no layout shift.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-content px-6 py-10 md:px-10" aria-busy="true">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-72" label="Loading institution name" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-14 w-48" label="Loading net price" />
          <Skeleton className="mt-3 h-4 w-40" />
        </Card>
        <Card>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-4 h-56 w-full" label="Loading trend chart" />
        </Card>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-6 w-20" />
          </Card>
        ))}
      </section>
    </main>
  );
}
