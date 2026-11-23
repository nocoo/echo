import { LayerCard } from "@nocoo/basalt";
import { Skeleton } from "@nocoo/basalt/components/skeleton";
import type { PageVariant } from "../lib/navigation";
import { CardSkeleton } from "./card-skeleton";

const TABLE_ROWS = [92, 78, 86, 70, 88, 74];

function PageHeaderSkeleton() {
  return (
    <div className="space-y-basalt-space-sm">
      <Skeleton height={26} width="22%" />
      <Skeleton height={14} width="37%" />
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <LayerCard>
      <div className="space-y-basalt-space-sm">
        <Skeleton height={14} width="20%" />
        {TABLE_ROWS.slice(0, rows).map((maxWidth) => (
          <Skeleton key={maxWidth} height={16} width={`${maxWidth - 15}%`} />
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
            <Skeleton height={12} width="39%" />
            <Skeleton height={18} width="32%" />
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
        <Skeleton key={key} height={28} width="14%" />
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
