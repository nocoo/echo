import { LayerCard } from "@nocoo/basalt";
import { Skeleton } from "@nocoo/basalt/components/skeleton";

const LINE_WIDTHS = [48, 64, 80, 92];

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <LayerCard>
      <div className="space-y-basalt-space-sm">
        <Skeleton height={14} width="26%" />
        {LINE_WIDTHS.slice(0, lines).map((width) => (
          <Skeleton key={width} height={12} width={`${width - 11}%`} />
        ))}
      </div>
    </LayerCard>
  );
}
