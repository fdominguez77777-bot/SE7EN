import { Skeleton } from '../chrome'

export function MetricSkeleton() {
  return <Skeleton className="h-[4.75rem]" />
}

export function CardSkeleton({ className = 'h-40' }: { className?: string }) {
  return <Skeleton className={className} />
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12" />
      ))}
    </div>
  )
}

export function PageSkeleton({
  metrics = 4,
  rows = 6,
}: {
  metrics?: number
  rows?: number
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div
        className={`grid grid-cols-2 gap-3 ${
          metrics >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
        }`}
      >
        {Array.from({ length: metrics }).map((_, index) => (
          <MetricSkeleton key={index} />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <TableSkeleton rows={rows} />
    </div>
  )
}
