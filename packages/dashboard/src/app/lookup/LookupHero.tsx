import { Badge, LayerCard } from "@nocoo/basalt";
import { Flag } from "../../components/visual/Flag";
import { MonoIp } from "../../components/visual/MonoIp";
import type { LookupViewModel } from "./use-lookup";

export function LookupHero({ model }: { model: LookupViewModel }) {
  const location = model.location;
  const place = [location?.country, location?.province, location?.city]
    .filter((part) => part && part.length > 0)
    .join(" · ");
  const badges = [
    location?.isp,
    location?.asn ? `ASN ${location.asn}` : null,
    location?.asOrg,
  ].filter((badge): badge is string => Boolean(badge && badge.length > 0));

  return (
    <LayerCard className="flex flex-col gap-basalt-space-sm">
      <div className="flex flex-wrap items-center gap-basalt-space-md">
        <Flag countryCode={location?.countryCode ?? null} className="text-2xl" />
        <MonoIp
          value={model.ip}
          className="text-xl font-semibold tracking-tight break-all text-basalt-foreground sm:text-2xl"
        />
      </div>

      <p className="text-basalt-sm text-basalt-foreground">{place || "未匹配到地理信息"}</p>

      {badges.length > 0 ? (
        <div className="flex flex-wrap gap-basalt-space-sm">
          {badges.map((badge) => (
            <Badge
              key={badge}
              variant="secondary"
              className="max-w-full whitespace-normal break-words text-left"
            >
              {badge}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-basalt-space-sm text-basalt-xs text-basalt-muted-foreground">
        <span className="truncate">来源 {model.source || "—"}</span>
        <MonoIp value={`${model.latencyMs}ms`} className="text-basalt-muted-foreground" />
      </div>
    </LayerCard>
  );
}
