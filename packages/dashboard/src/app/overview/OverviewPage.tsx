import { Badge, Button, StatStrip, Tooltip, TooltipContent, TooltipTrigger } from "@nocoo/basalt";
import { DataTable, type DataTableColumn } from "@nocoo/basalt/components/data-table";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { apiClient, type DatabaseEntry } from "../../lib/api";
import { formatAgeDays, formatBytes, formatDate, formatDateTime } from "../../lib/format";
import type { FreshnessStatus } from "./use-overview";
import { useOverview } from "./use-overview";

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

const FRESHNESS_LABELS: Record<FreshnessStatus, string> = {
  ok: "正常",
  stale: "陈旧",
  unknown: "未知",
};

export default function OverviewPage() {
  const { loading, error, model, reload } = useOverview(apiClient);

  const columns: DataTableColumn<DatabaseEntry>[] = [
    { id: "filename", header: "文件名", accessor: (row) => row.filename },
    { id: "provider", header: "来源", accessor: (row) => row.provider },
    { id: "size", header: "大小", accessor: (row) => formatBytes(row.size) },
    { id: "buildDate", header: "构建日期", accessor: (row) => formatDate(row.buildDate) },
    { id: "modifiedAt", header: "修改时间", accessor: (row) => formatDateTime(row.modifiedAt) },
    { id: "ageDays", header: "天数", accessor: (row) => formatAgeDays(row.ageDays) },
    {
      id: "status",
      header: "状态",
      accessor: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status]} dot>
          {STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
  ];

  const stats = model?.stats;

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

      <StatStrip
        loading={loading}
        items={[
          { label: "数据库", value: stats ? `${stats.presentCount}/${stats.databaseCount}` : "—" },
          { label: "数据年龄", value: stats ? formatAgeDays(stats.ageDays) : "—" },
          { label: "状态", value: stats ? FRESHNESS_LABELS[stats.status] : "—" },
          { label: "API key", value: stats ? String(stats.keyCount) : "—" },
        ]}
      />

      <DataTable
        aria-label="IP 数据库"
        data={model?.databases ?? []}
        columns={columns}
        loading={loading}
        empty="没有数据库记录"
        getRowId={(row) => row.filename}
      />
    </div>
  );
}
