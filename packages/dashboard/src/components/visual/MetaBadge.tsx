import { Badge } from "@nocoo/basalt";
import type { MetaTone } from "../../lib/visual";

const TONES: Record<MetaTone, string> = {
  blue: "border-basalt-tag-blue-border bg-basalt-tag-blue text-basalt-tag-blue-foreground",
  violet: "border-basalt-tag-violet-border bg-basalt-tag-violet text-basalt-tag-violet-foreground",
  teal: "border-basalt-tag-teal-border bg-basalt-tag-teal text-basalt-tag-teal-foreground",
};

export function MetaBadge({ tone, children }: { tone: MetaTone; children: string }) {
  return (
    <Badge
      variant={null}
      title={children}
      className={`h-6 max-w-[18rem] truncate border ${TONES[tone]}`}
    >
      {children}
    </Badge>
  );
}
