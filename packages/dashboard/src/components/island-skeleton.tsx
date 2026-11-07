import { LayerCard } from "@nocoo/basalt";
import { SkeletonLine } from "@nocoo/basalt/components/skeleton-line";
import type { PageVariant } from "../lib/navigation";
import { CardSkeleton } from "./card-skeleton";

const TABLE_ROWS = [92, 78, 86, 70, 88, 74];

function PageHeaderSkeleton() {
  return (
    <div className="space-y-basalt-space-sm">
      <SkeletonLine height={26} minWidth={18} maxWidth={26} />
      <SkeletonLine height={14} minWidth={30} maxWidth={44} />
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LayerCard>
      <div className="space-y-basalt-space-sm">
        <SkeletonLine height={14} minWidth={16} maxWidth={24} />
        {TABLE_ROWS.slice(0, rows).map((maxWidth) => (
          <SkeletonLine key={maxWidth} height={16} minWidth={maxWidth - 30} maxWidth={maxWidth} />
        ))}
      </div>
    </LayerCard>
  );
}

function StatRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-basalt-layout md:grid-cols-4">
      {["a", "b", "c", "d"].map((key) => (
        <LayerCard key={key}>
          <div className="space-y-basalt-space-sm">
            <SkeletonLine height={12} minWidth={30} maxWidth={48} />
            <SkeletonLine height={18} minWidth={24} maxWidth={40} />
          </div>
        </LayerCard>
      ))}
    </div>
  );
}

function TabRowSkeleton() {
  return (
    <div className="flex gap-basalt-space-sm">
      {["a", "b", "c", "d"].map((key) => (
        <SkeletonLine key={key} height={28} minWidth={12} maxWidth={16} />
      ))}
    </div>
  );
}

export function LookupResultSkeleton() {
  return (
    <>
      <CardSkeleton lines={3} />
      <TableSkeleton rows={4} />
    </>
  );
}

export function IslandSkeleton({ variant = "default" }: { variant?: PageVariant }) {
  return (
    <div className="space-y-basalt-layout-lg" role="status" aria-label="页面加载中">
      <PageHeaderSkeleton />
      {variant === "overview" ? (
        <>
          <StatRowSkeleton />
          <TableSkeleton rows={6} />
        </>
      ) : null}
      {variant === "lookup" ? (
        <>
          <CardSkeleton lines={2} />
          <LookupResultSkeleton />
        </>
      ) : null}
      {variant === "tools" ? (
        <>
          <TabRowSkeleton />
          <CardSkeleton lines={4} />
        </>
      ) : null}
      {variant === "keys" ? <TableSkeleton rows={6} /> : null}
      {variant === "default" ? (
        <div className="grid gap-basalt-layout md:grid-cols-2">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      ) : null}
    </div>
  );
}
