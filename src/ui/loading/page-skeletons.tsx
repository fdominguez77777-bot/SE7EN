import { FunLoader } from './fun-loader'
import { Skeleton } from '../chrome'

export function MetricSkeleton() {
  return <Skeleton className="h-[4.75rem]" />
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <FunLoader compact />
    </div>
  )
}

export function TableSkeleton({ rows: _rows = 6 }: { rows?: number }) {
  return <FunLoader compact />
}

export function PageSkeleton({
  metrics: _metrics = 4,
  rows: _rows = 6,
}: {
  metrics?: number
  rows?: number
}) {
  return <FunLoader />
}
