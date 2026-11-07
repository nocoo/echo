import {
  Button,
  Field,
  Input,
  LayerCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@nocoo/basalt";
import { DataTable, type DataTableColumn } from "@nocoo/basalt/components/data-table";
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { useMemo, useState } from "react";
import type { PrefixRow } from "../../lib/ip-math";
import { buildIpView, buildPrefixRows, convertCidr, evaluateContainment } from "./use-tools";

const prefixColumns: DataTableColumn<PrefixRow>[] = [
  { id: "prefix", header: "前缀", accessor: (row) => `/${row.prefix}` },
  { id: "mask", header: "掩码", accessor: (row) => row.mask },
  { id: "network", header: "网络地址", accessor: (row) => row.network },
  { id: "broadcast", header: "广播地址", accessor: (row) => row.broadcast },
  { id: "usable", header: "可用主机", accessor: (row) => row.usableHosts.toLocaleString() },
];

export default function ToolsPage() {
  const [cidr, setCidr] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("");
  const [target, setTarget] = useState("");

  const conversion = useMemo(() => convertCidr(cidr), [cidr]);
  const prefixRows = useMemo(() => buildPrefixRows(address), [address]);
  const containment = useMemo(() => evaluateContainment(network, target), [network, target]);
  const ipView = useMemo(() => buildIpView(address), [address]);

  return (
    <div className="space-y-basalt-layout-lg">
      <PageHeader title="IP 工具" description="掩码换算、网段计算、包含判断与进制视图。" />

      <Tabs defaultValue="cidr">
        <TabsList>
          <TabsTrigger value="cidr">CIDR 与掩码</TabsTrigger>
          <TabsTrigger value="prefix">网段表</TabsTrigger>
          <TabsTrigger value="containment">包含判断</TabsTrigger>
          <TabsTrigger value="radix">进制视图</TabsTrigger>
        </TabsList>

        <TabsContent value="cidr" className="mt-basalt-layout">
          <LayerCard>
            <Field
              label="前缀、掩码或 CIDR"
              htmlFor="tools-cidr"
              hint="例如 24、255.255.255.0 或 192.168.0.0/16"
              error={conversion.error ?? undefined}
            >
              <Input
                id="tools-cidr"
                value={cidr}
                onChange={(event) => setCidr(event.target.value)}
              />
            </Field>
            <dl className="mt-basalt-layout grid grid-cols-2 gap-basalt-layout">
              <div>
                <dt className="text-basalt-xs text-basalt-muted-foreground">前缀长度</dt>
                <dd className="text-basalt-base font-medium">
                  {conversion.prefix === null ? "—" : `/${conversion.prefix}`}
                </dd>
              </div>
              <div>
                <dt className="text-basalt-xs text-basalt-muted-foreground">子网掩码</dt>
                <dd className="text-basalt-base font-medium">{conversion.mask ?? "—"}</dd>
              </div>
            </dl>
          </LayerCard>
        </TabsContent>

        <TabsContent value="prefix" className="mt-basalt-layout">
          <LayerCard>
            <Field label="IPv4 地址" htmlFor="tools-address" hint="列出 /8 到 /32 的网段信息">
              <Input
                id="tools-address"
                value={address}
                placeholder="192.168.1.130"
                onChange={(event) => setAddress(event.target.value)}
              />
            </Field>
            {prefixRows.error ? (
              <p className="mt-basalt-space-sm text-basalt-sm text-basalt-danger">
                {prefixRows.error}
              </p>
            ) : null}
          </LayerCard>
          <div className="mt-basalt-layout">
            <DataTable
              aria-label="逐前缀网段"
              data={prefixRows.rows}
              columns={prefixColumns}
              empty="输入 IPv4 地址后显示网段表"
              getRowId={(row) => String(row.prefix)}
            />
          </div>
        </TabsContent>

        <TabsContent value="containment" className="mt-basalt-layout">
          <LayerCard>
            <div className="flex flex-col gap-basalt-layout md:flex-row">
              <Field label="网段" htmlFor="tools-network" className="flex-1">
                <Input
                  id="tools-network"
                  value={network}
                  placeholder="10.0.0.0/8"
                  onChange={(event) => setNetwork(event.target.value)}
                />
              </Field>
              <Field label="地址" htmlFor="tools-target" className="flex-1">
                <Input
                  id="tools-target"
                  value={target}
                  placeholder="10.1.2.3"
                  onChange={(event) => setTarget(event.target.value)}
                />
              </Field>
            </div>
            <p className="mt-basalt-layout text-basalt-sm">
              {containment.error ? (
                <span className="text-basalt-danger">{containment.error}</span>
              ) : containment.contains === null ? (
                <span className="text-basalt-muted-foreground">输入网段与地址后显示结果</span>
              ) : containment.contains ? (
                <span className="text-basalt-success">该地址在网段内</span>
              ) : (
                <span className="text-basalt-danger">该地址不在网段内</span>
              )}
            </p>
          </LayerCard>
        </TabsContent>

        <TabsContent value="radix" className="mt-basalt-layout">
          <LayerCard>
            <Field label="地址" htmlFor="tools-radix" hint="IPv4 与 IPv6 均支持">
              <Input
                id="tools-radix"
                value={address}
                placeholder="2001:db8::1"
                onChange={(event) => setAddress(event.target.value)}
              />
            </Field>
            {ipView.error ? (
              <p className="mt-basalt-space-sm text-basalt-sm text-basalt-danger">{ipView.error}</p>
            ) : null}
            <dl className="mt-basalt-layout space-y-basalt-layout">
              <div>
                <dt className="text-basalt-xs text-basalt-muted-foreground">二进制</dt>
                <dd className="break-all font-mono text-basalt-sm">{ipView.binary || "—"}</dd>
              </div>
              <div>
                <dt className="text-basalt-xs text-basalt-muted-foreground">十六进制</dt>
                <dd className="break-all font-mono text-basalt-sm">{ipView.hex || "—"}</dd>
              </div>
              {ipView.expanded ? (
                <div>
                  <dt className="text-basalt-xs text-basalt-muted-foreground">IPv6 展开</dt>
                  <dd className="break-all font-mono text-basalt-sm">{ipView.expanded}</dd>
                </div>
              ) : null}
              {ipView.compressed ? (
                <div>
                  <dt className="text-basalt-xs text-basalt-muted-foreground">IPv6 压缩</dt>
                  <dd className="break-all font-mono text-basalt-sm">{ipView.compressed}</dd>
                </div>
              ) : null}
            </dl>
            <Button
              variant="ghost"
              size="sm"
              className="mt-basalt-layout"
              onClick={() => setAddress(ipView.compressed ?? ipView.expanded ?? address)}
            >
              应用规范化结果
            </Button>
          </LayerCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
