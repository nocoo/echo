import { Button, Field, Input, LayerCard } from "@nocoo/basalt";
import { DataTable, type DataTableColumn } from "@nocoo/basalt/components/data-table";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import type { FormEvent } from "react";
import { useState } from "react";
import { CardSkeleton } from "../../components/card-skeleton";
import { apiClient, type ProviderResult } from "../../lib/api";
import { useLookup } from "./use-lookup";

export default function LookupPage() {
  const [ip, setIp] = useState("");
  const { loading, error, model, submit } = useLookup(apiClient);

  const providerColumns: DataTableColumn<ProviderResult>[] = [
    { id: "name", header: "数据源", accessor: (row) => row.name },
    {
      id: "result",
      header: "结果",
      accessor: (row) =>
        row.error
          ? "失败"
          : [row.location?.country, row.location?.province, row.location?.city]
              .filter((part) => part && part.length > 0)
              .join(" / ") || "—",
    },
    { id: "isp", header: "ISP", accessor: (row) => row.location?.isp || "—" },
    { id: "asn", header: "ASN", accessor: (row) => row.location?.asn ?? "—" },
    { id: "latency", header: "耗时", accessor: (row) => `${row.latencyMs} ms` },
  ];

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(ip);
  };

  return (
    <div className="space-y-basalt-layout-lg">
      <PageHeader title="IP 查询" description="使用管理台会话查询任意地址的四路数据源结果。" />

      <LayerCard>
        <form
          className="flex flex-col gap-basalt-layout md:flex-row md:items-end"
          onSubmit={onSubmit}
        >
          <Field label="目标地址" htmlFor="lookup-ip" className="flex-1">
            <Input
              id="lookup-ip"
              value={ip}
              placeholder="8.8.8.8"
              onChange={(event) => setIp(event.target.value)}
            />
          </Field>
          <Button type="submit" loading={loading} disabled={ip.trim().length === 0}>
            查询
          </Button>
        </form>
      </LayerCard>

      {error ? (
        <p className="rounded-basalt-md bg-basalt-danger-tint px-basalt-space-md py-basalt-space-sm text-basalt-sm text-basalt-danger">
          {error}
        </p>
      ) : null}

      {loading && !model ? <CardSkeleton lines={4} /> : null}

      {model ? (
        <>
          <LayerCard>
            <dl className="grid grid-cols-2 gap-basalt-layout md:grid-cols-4">
              <div>
                <dt className="text-basalt-xs text-basalt-muted-foreground">地址</dt>
                <dd className="text-basalt-base font-medium">{model.ip}</dd>
              </div>
              <div>
                <dt className="text-basalt-xs text-basalt-muted-foreground">版本</dt>
                <dd className="text-basalt-base font-medium">IPv{model.version}</dd>
              </div>
              <div>
                <dt className="text-basalt-xs text-basalt-muted-foreground">来源</dt>
                <dd className="text-basalt-base font-medium">{model.source || "—"}</dd>
              </div>
              <div>
                <dt className="text-basalt-xs text-basalt-muted-foreground">耗时</dt>
                <dd className="text-basalt-base font-medium">{model.latencyMs} ms</dd>
              </div>
            </dl>
            <p className="mt-basalt-layout text-basalt-sm text-basalt-muted-foreground">
              {model.location
                ? [
                    model.location.country,
                    model.location.province,
                    model.location.city,
                    model.location.isp,
                    model.location.asOrg,
                  ]
                    .filter((part) => part && part.length > 0)
                    .join(" · ")
                : "没有匹配的地理位置"}
            </p>
            {model.attribution.length > 0 ? (
              <p className="mt-basalt-space-sm text-basalt-xs text-basalt-muted-foreground">
                {model.attribution.join(" / ")}
              </p>
            ) : null}
          </LayerCard>

          <DataTable
            aria-label="数据源明细"
            data={model.providers}
            columns={providerColumns}
            empty="没有数据源结果"
            getRowId={(row) => row.name}
          />
        </>
      ) : null}
    </div>
  );
}
