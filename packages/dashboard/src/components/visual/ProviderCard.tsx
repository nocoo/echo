import { LayerCard } from "@nocoo/basalt";
import type { ProviderResult } from "../../lib/api";
import { providerFields, providerHit } from "../../lib/visual";
import { Flag } from "./Flag";
import { LatencyDots } from "./LatencyDots";
import { ProviderIcon } from "./ProviderIcon";
import { StatusDot } from "./StatusDot";

export function ProviderCard({ provider }: { provider: ProviderResult }) {
  const hit = providerHit(provider);
  const fields = providerFields(provider.location);

  return (
    <LayerCard className="flex flex-col gap-basalt-space-sm">
      <div className="flex items-center gap-basalt-space-sm">
        <ProviderIcon provider={provider.name} />
        <span className="flex-1 truncate text-sm font-medium text-basalt-foreground">
          {provider.name}
        </span>
        <StatusDot tone={hit ? "success" : "destructive"} />
      </div>

      <div className="flex items-center justify-between gap-basalt-space-sm">
        <Flag countryCode={provider.location?.countryCode ?? null} />
        <LatencyDots latencyMs={provider.latencyMs} tone={hit ? "success" : "destructive"} />
      </div>

      {fields.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-basalt-space-md gap-y-basalt-space-xs">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-[11px] text-basalt-muted-foreground">{field.label}</dt>
              <dd className="truncate text-xs text-basalt-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-basalt-muted-foreground">
          {hit ? "未返回地理信息" : "查询失败"}
        </p>
      )}
    </LayerCard>
  );
}
