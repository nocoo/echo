import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@nocoo/basalt";
import { StatCard } from "@nocoo/basalt/charts/stat-card";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { Clock3, Database, HardDrive, KeyRound } from "lucide-react";
import { apiClient } from "../../lib/api";
import { formatAgeDays, formatBytes } from "../../lib/format";
import { statusTone, toneClasses } from "../../lib/visual";
import { DatabaseCard } from "./DatabaseCard";
import { useOverview } from "./use-overview";

export default function OverviewPage() {
  const { loading, error, model, reload } = useOverview(apiClient);
  const stats = model?.stats;
  const tone = toneClasses(
    statusTone(stats?.status === "unknown" ? "idle" : (stats?.status ?? "idle")),
  );

  return (
    <div className="space-y-basalt-layout-lg">
      <PageHeader
        title="数据库概览"
        description="逐库查看 IP 数据库的新鲜度与来源。"
        actions={
          <>
            <Button variant="outline" onClick={() => void reload()} loading={loading}>
              重新加载
            </Button>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button disabled>刷新数据库</Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>刷新触发将在 P2 接入</TooltipContent>
            </Tooltip>
          </>
        }
      />

      {error ? (
        <p className="rounded-basalt-md bg-basalt-danger-tint px-basalt-space-md py-basalt-space-sm text-basalt-sm text-basalt-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-basalt-layout xl:grid-cols-4">
        <StatCard
          label="数据年龄"
          value={stats ? formatAgeDays(stats.ageDays) : "—"}
          subtitle="超过 7 天视为陈旧"
          icon={Clock3}
          iconColor={tone.text}
        />
        <StatCard
          label="数据库"
          value={stats ? `${stats.presentCount}/${stats.databaseCount}` : "—"}
          subtitle={stats ? `${stats.missingCount} 个缺失` : undefined}
          icon={Database}
        />
        <StatCard
          label="总大小"
          value={stats ? formatBytes(stats.totalSizeBytes) : "—"}
          subtitle="已安装文件合计"
          icon={HardDrive}
        />
        <StatCard
          label="有效 key"
          value={stats ? String(stats.activeKeyCount) : "—"}
          subtitle={stats ? `共 ${stats.keyCount} 个` : undefined}
          icon={KeyRound}
        />
      </div>

      <div className="grid gap-basalt-layout md:grid-cols-2 xl:grid-cols-3">
        {(model?.databases ?? []).map((database) => (
          <DatabaseCard key={database.filename} database={database} />
        ))}
      </div>
    </div>
  );
}
