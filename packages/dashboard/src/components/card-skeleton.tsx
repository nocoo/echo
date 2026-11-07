import { LayerCard } from "@nocoo/basalt";
import { SkeletonLine } from "@nocoo/basalt/components/skeleton-line";

const LINE_WIDTHS = [48, 64, 80, 92];

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <LayerCard>
      <div className="space-y-basalt-space-sm">
        <SkeletonLine height={14} minWidth={20} maxWidth={32} />
        {LINE_WIDTHS.slice(0, lines).map((maxWidth) => (
          <SkeletonLine key={maxWidth} height={12} minWidth={maxWidth - 22} maxWidth={maxWidth} />
        ))}
      </div>
    </LayerCard>
  );
}
