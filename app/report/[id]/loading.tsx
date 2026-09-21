import { CategorySkeleton } from '@/components/report/category-bars';
import { Skeleton } from '@/components/ui/primitives';

/** Mirrors the report layout so nothing shifts when data lands. */
export default function ReportLoading() {
  return (
    <div className="flex flex-col" aria-busy="true" aria-label="Loading report">
      <div className="border-b border-line">
        <div className="container-x flex h-12 items-center justify-between">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      <div className="container-x grid grid-cols-1 gap-8 py-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="panel flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
            <div className="skeleton h-[188px] w-[188px] shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-3 h-5 w-48" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <CategorySkeleton />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-7">
          <div className="flex gap-4 border-b border-line pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-[min(78dvh,900px)]" />
        </div>
      </div>
    </div>
  );
}
