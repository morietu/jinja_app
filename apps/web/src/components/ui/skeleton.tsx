// apps/web/src/components/ui/skeleton.tsx
import * as React from "react";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * シンプルなローディング用 Skeleton
 * Tailwind のクラスは必要に応じて調整してOK
 */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return <div className={`animate-pulse rounded-md bg-slate-800/70 ${className}`} {...props} />;
}

export default Skeleton;
