import { LayerCard } from "@nocoo/basalt";
import type { ProviderResult } from "../../lib/api";
import { outcomeLabel, outcomeTone, providerFields, providerOutcome } from "../../lib/visual";
import { Flag } from "./Flag";
import { LatencyDots } from "./LatencyDots";
import { ProviderIcon } from "./ProviderIcon";
import { StatusDot } from "./StatusDot";

export function ProviderCard({ provider }: { provider: ProviderResult }) {
  const outcome = providerOutcome(provider);
  const tone = outcomeTone(outcome);
  const fields = providerFields(provider.location);

  return (
    <LayerCard className="flex h-full flex-col gap-basalt-space-sm">
      <div className="flex items-center gap-basalt-space-sm">
        <ProviderIcon provider={provider.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-basalt-foreground">{provider.name}</p>
          <p className="text-basalt-xs text-basalt-muted-foreground">{outcomeLabel(outcome)}</p>
        </div>
        <StatusDot tone={tone} />
      </div>

      <div className="flex items-center justify-between gap-basalt-space-sm">
        <Flag countryCode={provider.location?.countryCode ?? null} />
        <LatencyDots latencyMs={provider.latencyMs} tone={tone} />
      </div>

      {fields.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-basalt-space-md gap-y-basalt-space-xs">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-basalt-xs text-basalt-muted-foreground">{field.label}</dt>
              <dd className="break-words text-basalt-xs text-basalt-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </LayerCard>
  );
}
