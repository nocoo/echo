import type { ProviderResult } from "./cache.js";
import type { IpLocation } from "./ipProvider.js";

const PRIORITY: Record<string, number> = {
  ip2region: 1,
  "ip-location-db": 2,
  iplocate: 3,
  circl: 4,
};

export interface SelectionResult {
  location: IpLocation;
  source: string;
}

function hasLocation(loc: IpLocation): boolean {
  return loc.countryCode !== "" || loc.city !== "";
}

type ValidResult = ProviderResult & { location: IpLocation };

function sortByPriority(arr: ValidResult[]): ValidResult[] {
  return arr.sort((a, b) => (PRIORITY[a.name] ?? 99) - (PRIORITY[b.name] ?? 99));
}

export function selectBest(results: ProviderResult[]): SelectionResult | null {
  const nonNull = results.filter((r): r is ValidResult => r.location !== null);

  if (nonNull.length === 0) return null;

  const withLocation = nonNull.filter((r) => hasLocation(r.location));

  if (withLocation.length === 0) {
    const sorted = sortByPriority(nonNull);
    return enrichAsn(sorted[0] as ValidResult, nonNull);
  }

  const sorted = sortByPriority(withLocation);
  const top = sorted[0] as ValidResult;

  if (top.name === "ip2region" && top.location.countryCode === "CN") {
    return enrichAsn(top, nonNull);
  }

  const ipLocationDb = withLocation.find((r) => r.name === "ip-location-db");
  if (ipLocationDb) {
    return enrichAsn(ipLocationDb, nonNull);
  }

  return enrichAsn(top, nonNull);
}

function enrichAsn(chosen: ValidResult, all: ValidResult[]): SelectionResult {
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
