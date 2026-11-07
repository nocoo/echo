import { Badge, LayerCard } from "@nocoo/basalt";
import { FreshnessBar } from "../../components/visual/FreshnessBar";
import { ProviderIcon } from "../../components/visual/ProviderIcon";
import type { DatabaseEntry } from "../../lib/api";
import { formatBytes, formatDate, formatDateTime } from "../../lib/format";
import { statusTone, toneClasses } from "../../lib/visual";

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
  const tone = toneClasses(statusTone(database.status));
  const missing = !database.present;

  return (
    <LayerCard
      className={`flex flex-col gap-basalt-space-md ${missing ? "saturate-0 opacity-70" : ""}`}
    >
      <div
        className={`flex items-start gap-basalt-space-sm ${
          missing ? "border-l-2 border-basalt-destructive pl-basalt-space-sm" : ""
        }`}
      >
        <ProviderIcon provider={database.provider} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm text-basalt-foreground">{database.filename}</p>
          <p className="truncate text-[11px] text-basalt-muted-foreground">{database.provider}</p>
        </div>
        <Badge variant={STATUS_VARIANTS[database.status]}>{STATUS_LABELS[database.status]}</Badge>
      </div>

      <dl className="grid grid-cols-2 gap-x-basalt-space-md gap-y-basalt-space-xs">
        <div className="min-w-0">
          <dt className="text-[11px] text-basalt-muted-foreground">大小</dt>
          <dd className="truncate font-mono text-xs text-basalt-foreground">
            {formatBytes(database.size)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-basalt-muted-foreground">构建日期</dt>
          <dd className="truncate font-mono text-xs text-basalt-foreground">
            {formatDate(database.buildDate)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-basalt-muted-foreground">修改时间</dt>
          <dd className="truncate font-mono text-xs text-basalt-foreground">
            {formatDateTime(database.modifiedAt)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] text-basalt-muted-foreground">状态</dt>
          <dd className={`truncate text-xs ${tone.text}`}>
            {database.present ? "已就绪" : "未安装"}
          </dd>
        </div>
      </dl>

      <FreshnessBar ageDays={database.ageDays} status={database.status} />
    </LayerCard>
  );
}
