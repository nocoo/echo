import { Badge, LayerCard } from "@nocoo/basalt";
import { FreshnessBar } from "../../components/visual/FreshnessBar";
import { ProviderIcon } from "../../components/visual/ProviderIcon";
import type { DatabaseEntry } from "../../lib/api";
import { formatBytes, formatDate, formatDateTime } from "../../lib/format";

const STATUS_VARIANTS: Record<DatabaseEntry["status"], "success" | "warning" | "destructive"> = {
  ok: "success",
  stale: "warning",
  missing: "destructive",
};

const STATUS_LABELS: Record<DatabaseEntry["status"], string> = {
  ok: "正常",
  stale: "陈旧",
  missing: "缺失",
};

export function DatabaseCard({ database }: { database: DatabaseEntry }) {
  const missing = !database.present;
  const valueClass = missing ? "text-basalt-muted-foreground" : "text-basalt-foreground";

  return (
    <LayerCard className="flex flex-col gap-basalt-space-md">
      <div
        className={`flex items-start gap-basalt-space-sm ${
          missing ? "border-l-2 border-basalt-tag-danger-foreground pl-basalt-space-sm" : ""
        }`}
      >
        <ProviderIcon provider={database.provider} />
        <div className="min-w-0 flex-1">
          <p className="break-all font-mono text-basalt-sm text-basalt-foreground">
            {database.filename}
          </p>
          <p className="truncate text-basalt-xs text-basalt-muted-foreground">
            {database.provider}
          </p>
        </div>
        <Badge variant={STATUS_VARIANTS[database.status]}>{STATUS_LABELS[database.status]}</Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-basalt-space-md gap-y-basalt-space-xs">
        <div className="min-w-0">
          <dt className="text-basalt-xs text-basalt-muted-foreground">大小</dt>
          <dd className={`truncate font-mono text-basalt-xs ${valueClass}`}>
            {formatBytes(database.size)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-basalt-xs text-basalt-muted-foreground">构建日期</dt>
          <dd className={`truncate font-mono text-basalt-xs ${valueClass}`}>
            {formatDate(database.buildDate)}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-basalt-xs text-basalt-muted-foreground">修改时间</dt>
          <dd className={`font-mono text-basalt-xs ${valueClass}`}>
            {formatDateTime(database.modifiedAt)}
          </dd>
        </div>
      </dl>

      <FreshnessBar ageDays={database.ageDays} status={database.status} />
    </LayerCard>
  );
}
