import { LayerCard } from "@nocoo/basalt";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nocoo/basalt/components/table";
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
        <Table className="min-w-[34rem]">
          <TableCaption className="px-basalt-space-md py-basalt-space-sm text-left text-basalt-xs text-basalt-muted-foreground">
            每个前缀下的网络地址、广播地址与可用主机数
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>前缀</TableHead>
              <TableHead>掩码</TableHead>
              <TableHead>网络地址</TableHead>
              <TableHead>广播地址</TableHead>
              <TableHead textAlign="end">可用主机</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const active = row.prefix === activePrefix;
              return (
                <TableRow
                  key={row.prefix}
                  variant={active ? "selected" : "default"}
                  aria-current={active ? "true" : undefined}
                >
                  <TableHead scope="row">
                    <span className="flex items-center gap-basalt-space-xs">
                      {active ? (
                        <span aria-hidden="true" className="text-basalt-foreground">
                          ●
                        </span>
                      ) : null}
                      <span className="font-mono tabular-nums text-basalt-foreground">
                        /{row.prefix}
                      </span>
                      {active ? <span className="sr-only">当前前缀</span> : null}
                    </span>
                  </TableHead>
                  <TableCell className="font-mono tabular-nums text-basalt-foreground">
                    {row.mask}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-basalt-foreground">
                    {row.network}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-basalt-foreground">
                    {row.broadcast}
                  </TableCell>
                  <TableCell
                    textAlign="end"
                    className="font-mono tabular-nums text-basalt-foreground"
                  >
                    {row.usableHosts.toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </LayerCard>
  );
}
