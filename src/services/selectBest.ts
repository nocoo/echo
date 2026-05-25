import type { IpLocation } from "./ipProvider.js";
import type { ProviderResult } from "./cache.js";

const PRIORITY: Record<string, number> = {
  "ip2region": 1,
  "ip-location-db": 2,
  "iplocate": 3,
  "circl": 4,
};

export type SelectionResult = {
  location: IpLocation;
  source: string;
};

function hasLocation(loc: IpLocation): boolean {
  return loc.countryCode !== "" || loc.city !== "";
}

export function selectBest(results: ProviderResult[]): SelectionResult | null {
  const valid = results.filter(
    (r): r is ProviderResult & { location: IpLocation } => r.location !== null,
  );

  if (valid.length === 0) return null;

  valid.sort((a, b) => (PRIORITY[a.name] ?? 99) - (PRIORITY[b.name] ?? 99));

  const top = valid[0]!;

  if (top.name === "ip2region" && top.location.countryCode === "CN") {
    return enrichAsn(top, valid);
  }

  const ipLocationDb = valid.find(
    (r) => r.name === "ip-location-db" && hasLocation(r.location),
  );
  if (ipLocationDb) {
    return enrichAsn(ipLocationDb, valid);
  }

  return enrichAsn(top, valid);
}

function enrichAsn(
  chosen: ProviderResult & { location: IpLocation },
  all: Array<ProviderResult & { location: IpLocation }>,
): SelectionResult {
  let location = chosen.location;

  if (location.asn === null) {
    const asnSource = all.find((r) => r.location.asn !== null);
    if (asnSource) {
      location = {
        ...location,
        asn: asnSource.location.asn,
        asOrg: asnSource.location.asOrg,
      };
    }
  }

  return {
    location,
    source: chosen.name,
  };
}
