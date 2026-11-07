import { SkeletonLine } from "@nocoo/basalt/components/skeleton-line";
import { CardSkeleton } from "./card-skeleton";

export function IslandSkeleton() {
  return (
    <div className="space-y-basalt-layout-lg" role="status" aria-label="页面加载中">
      <div className="space-y-basalt-space-sm">
        <SkeletonLine height={26} minWidth={18} maxWidth={26} />
        <SkeletonLine height={14} minWidth={30} maxWidth={44} />
      </div>
      <div className="grid gap-basalt-layout md:grid-cols-2">
        <CardSkeleton lines={4} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}
