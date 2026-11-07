import { Building2, Globe2, type LucideIcon, Map as MapIcon, Radio } from "lucide-react";
import { providerAccent } from "../../lib/visual";

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  ip2region: MapIcon,
  iplocate: Globe2,
  "ip-location-db": Building2,
  circl: Radio,
};

export function ProviderIcon({ provider, size = "md" }: { provider: string; size?: "sm" | "md" }) {
  const accent = providerAccent(provider);
  const Icon = PROVIDER_ICONS[provider] ?? Globe2;
  const box = size === "sm" ? "size-6 rounded-basalt-sm" : "size-8 rounded-basalt-md";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${box} ${accent.surface} ${accent.text}`}
    >
      <Icon
        className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </span>
  );
}
