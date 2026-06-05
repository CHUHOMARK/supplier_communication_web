import { Skeleton } from "@/components/ui/skeleton";

interface MaterialTableSkeletonProps {
  rows?: number;
}

export function MaterialTableSkeleton({ rows = 10 }: MaterialTableSkeletonProps) {
  return (
    <div className="space-y-2">
      {/* 表头 */}
      <div className="flex gap-4 p-4 bg-muted rounded-lg">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* 表行 */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border rounded-lg animate-pulse">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
