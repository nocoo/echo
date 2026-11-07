import { Badge, LayerCard } from "@nocoo/basalt";
import { Flag } from "../../components/visual/Flag";
import { MonoIp } from "../../components/visual/MonoIp";
import type { LookupViewModel } from "./use-lookup";

export function LookupHero({ model }: { model: LookupViewModel }) {
  const location = model.location;
  const place = [location?.country, location?.province, location?.city]
    .filter((part) => part && part.length > 0)
    .join(" · ");

  return (
    <LayerCard className="flex flex-col gap-basalt-layout self-start">
      <div className="flex items-center gap-basalt-space-md">
        <Flag countryCode={location?.countryCode ?? null} className="text-3xl" />
        <MonoIp
          value={model.ip}
          className="text-xl font-semibold tracking-tight break-all text-basalt-foreground sm:text-2xl"
        />
      </div>

      <p className="text-sm text-basalt-foreground">{place || "未匹配到地理信息"}</p>

      <div className="flex flex-wrap gap-basalt-space-sm">
        {location?.isp ? <Badge variant="secondary">{location.isp}</Badge> : null}
        {location?.asn ? <Badge variant="secondary">ASN {location.asn}</Badge> : null}
        {location?.asOrg ? <Badge variant="secondary">{location.asOrg}</Badge> : null}
      </div>

      <div className="flex items-center justify-between gap-basalt-space-sm text-[11px] text-basalt-muted-foreground">
        <span className="truncate">来源 {model.source || "—"}</span>
        <MonoIp value={`${model.latencyMs}ms`} className="text-basalt-muted-foreground" />
      </div>
    </LayerCard>
  );
}
