import { LayerCard } from "@nocoo/basalt";
import type { PrefixRow } from "../../lib/ip-math";

export function PrefixTable({
  rows,
  activePrefix,
}: {
  rows: PrefixRow[];
  activePrefix: number | null;
}) {
  return (
    <LayerCard padding="none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead className="text-[11px] text-basalt-muted-foreground">
            <tr>
              <th className="px-basalt-space-md py-basalt-space-sm font-medium">前缀</th>
              <th className="px-basalt-space-md py-basalt-space-sm font-medium">掩码</th>
              <th className="px-basalt-space-md py-basalt-space-sm font-medium">网络地址</th>
              <th className="px-basalt-space-md py-basalt-space-sm font-medium">广播地址</th>
              <th className="px-basalt-space-md py-basalt-space-sm font-medium">可用主机</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = row.prefix === activePrefix;
              return (
                <tr
                  key={row.prefix}
                  className={active ? "bg-basalt-chart-1/10" : "border-t border-basalt-border/50"}
                >
                  <td
                    className={`px-basalt-space-md py-basalt-space-sm font-mono tabular-nums ${
                      active ? "font-semibold text-basalt-chart-1" : "text-basalt-foreground"
                    }`}
                  >
                    /{row.prefix}
                  </td>
                  <td className="px-basalt-space-md py-basalt-space-sm font-mono tabular-nums text-basalt-foreground">
                    {row.mask}
                  </td>
                  <td className="px-basalt-space-md py-basalt-space-sm font-mono tabular-nums text-basalt-foreground">
                    {row.network}
                  </td>
                  <td className="px-basalt-space-md py-basalt-space-sm font-mono tabular-nums text-basalt-foreground">
                    {row.broadcast}
                  </td>
                  <td className="px-basalt-space-md py-basalt-space-sm font-mono tabular-nums text-basalt-foreground">
                    {row.usableHosts.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </LayerCard>
  );
}
