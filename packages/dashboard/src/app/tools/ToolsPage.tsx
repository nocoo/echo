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
import { PageHeader } from "@nocoo/basalt/components/page-header";
import { useMemo, useState } from "react";
import { describeNetwork } from "../../lib/ip-math";
import { PrefixTable } from "./PrefixTable";
import { buildIpView, buildPrefixRows, evaluateContainment, parseNetworkInput } from "./use-tools";

const NETWORK_TINTS = [
  "text-basalt-chart-1",
  "text-basalt-chart-2",
  "text-basalt-chart-3",
  "text-basalt-chart-4",
  "text-basalt-chart-5",
];

export default function ToolsPage() {
  const [network, setNetwork] = useState("");
  const [target, setTarget] = useState("");
  const [radixAddress, setRadixAddress] = useState("");

  const input = useMemo(() => parseNetworkInput(network), [network]);
  const address = input.address ?? "";
  const prefixRows = useMemo(() => buildPrefixRows(address), [address]);
  const ipView = useMemo(() => buildIpView(radixAddress), [radixAddress]);
  const cidrText = input.prefix === null ? address : `${address}/${input.prefix}`;
  const containment = useMemo(() => evaluateContainment(cidrText, target), [cidrText, target]);
  const described =
    input.address !== null && input.prefix !== null
      ? describeNetwork(input.address, input.prefix)
      : null;

  const networkCards = described
    ? [
        { label: "网络地址", value: described.network },
        { label: "广播地址", value: described.broadcast },
        { label: "首个主机", value: described.firstHost },
        { label: "末个主机", value: described.lastHost },
        { label: "可用主机", value: described.usableHosts.toLocaleString() },
      ]
    : [];

  return (
    <div className="space-y-basalt-layout-lg">
      <PageHeader title="IP 工具" description="掩码换算、网段计算、包含判断与进制视图。" />

      <LayerCard>
        <Field
          label="地址或 CIDR"
          htmlFor="tools-network"
          hint="例如 192.168.1.130 或 192.168.1.130/24"
          error={
            network.trim().length > 0 && input.address === null
              ? "请输入有效的 IPv4 地址"
              : undefined
          }
        >
          <Input
            id="tools-network"
            value={network}
            placeholder="192.168.1.130/24"
            onChange={(event) => setNetwork(event.target.value)}
          />
        </Field>
      </LayerCard>

      <Tabs defaultValue="network">
        <TabsList>
          <TabsTrigger value="network">网段</TabsTrigger>
          <TabsTrigger value="prefix">前缀表</TabsTrigger>
          <TabsTrigger value="containment">包含判断</TabsTrigger>
          <TabsTrigger value="radix">进制视图</TabsTrigger>
        </TabsList>

        <TabsContent value="network" className="mt-basalt-layout">
          <div className="grid gap-basalt-layout md:grid-cols-2 xl:grid-cols-3">
            {networkCards.length > 0 ? (
              networkCards.map((card, index) => (
                <LayerCard key={card.label} className="flex flex-col gap-basalt-space-xs">
                  <span className="text-[11px] text-basalt-muted-foreground">{card.label}</span>
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      NETWORK_TINTS[index % NETWORK_TINTS.length]
                    }`}
                  >
                    {card.value}
                  </span>
                </LayerCard>
              ))
            ) : (
              <LayerCard className="sm:col-span-2 xl:col-span-3">
                <p className="text-sm text-basalt-muted-foreground">
                  输入带前缀的 CIDR 后显示网段、广播与可用主机。
                </p>
              </LayerCard>
            )}
          </div>
        </TabsContent>

        <TabsContent value="prefix" className="mt-basalt-layout">
          {prefixRows.error ? (
            <p className="mb-basalt-layout text-sm text-basalt-destructive">{prefixRows.error}</p>
          ) : null}
          <PrefixTable rows={prefixRows.rows} activePrefix={input.prefix} />
        </TabsContent>

        <TabsContent value="containment" className="mt-basalt-layout">
          <LayerCard>
            <Field label="被检查的地址" htmlFor="tools-target" hint="网段取自上方的地址或 CIDR">
              <Input
                id="tools-target"
                value={target}
                placeholder="192.168.1.140"
                onChange={(event) => setTarget(event.target.value)}
              />
            </Field>
            <p className="mt-basalt-layout text-sm">
              {containment.error ? (
                <span className="text-basalt-destructive">{containment.error}</span>
              ) : containment.contains === null ? (
                <span className="text-basalt-muted-foreground">输入地址后显示结果</span>
              ) : containment.contains ? (
                <span className="text-basalt-success">该地址在网段内</span>
              ) : (
                <span className="text-basalt-destructive">该地址不在网段内</span>
              )}
            </p>
          </LayerCard>
        </TabsContent>

        <TabsContent value="radix" className="mt-basalt-layout">
          <LayerCard>
            <Field label="地址" htmlFor="tools-radix" hint="IPv4 与 IPv6 均支持">
              <Input
                id="tools-radix"
                value={radixAddress}
                placeholder="2001:db8::1"
                onChange={(event) => setRadixAddress(event.target.value)}
              />
            </Field>
            {ipView.error ? (
              <p className="text-sm text-basalt-destructive">{ipView.error}</p>
            ) : null}
            <dl className="space-y-basalt-layout">
              <div>
                <dt className="text-[11px] text-basalt-muted-foreground">二进制</dt>
                <dd className="break-all font-mono text-xs">{ipView.binary || "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-basalt-muted-foreground">十六进制</dt>
                <dd className="break-all font-mono text-xs">{ipView.hex || "—"}</dd>
              </div>
              {ipView.expanded ? (
                <div>
                  <dt className="text-[11px] text-basalt-muted-foreground">IPv6 展开</dt>
                  <dd className="break-all font-mono text-xs">{ipView.expanded}</dd>
                </div>
              ) : null}
              {ipView.compressed ? (
                <div>
                  <dt className="text-[11px] text-basalt-muted-foreground">IPv6 压缩</dt>
                  <dd className="break-all font-mono text-xs">{ipView.compressed}</dd>
                </div>
              ) : null}
            </dl>
            <Button
              variant="ghost"
              size="sm"
              className="mt-basalt-layout"
              disabled={!ipView.compressed}
              onClick={() => setNetwork(ipView.compressed ?? network)}
            >
              应用规范化结果
            </Button>
          </LayerCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
