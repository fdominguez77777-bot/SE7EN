import { Skeleton } from '../chrome'

export function MetricSkeleton() {
  return <Skeleton className="h-[4.75rem]" />
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return <Skeleton className={`h-28 w-full ${className}`} />
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-11 w-full" />
      ))}
    </div>
  )
}

export function PageSkeleton({
  metrics = 2,
  rows = 6,
}: {
  metrics?: number
  rows?: number
}) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: metrics }, (_, index) => (
          <MetricSkeleton key={index} />
        ))}
      </div>
      <TableSkeleton rows={rows} />
    </div>
  )
}
