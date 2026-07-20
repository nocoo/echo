import { parseClientIp } from "../utils/ip.js";
import type { CachedLookup, ProviderResult } from "./cache.js";
import { getCached, resetCache, setCached } from "./cache.js";
import type { IpLocation, IpProvider } from "./ipProvider.js";
import { CirclProvider } from "./providers/circl.js";
import { IpLocationDbProvider } from "./providers/ip-location-db.js";
import { Ip2RegionProvider } from "./providers/ip2region.js";
import { IplocateProvider } from "./providers/iplocate.js";
import { selectBest } from "./selectBest.js";

export type { IpLocation };

export interface LookupResult {
  ip: string;
  version: 4 | 6;
  location: IpLocation | null;
  source: string;
  attribution: string[];
  latencyMs: number;
  providers?: ProviderResult[];
}

let providers: IpProvider[] | undefined;

export function getProviders(): IpProvider[] {
  providers ??= [
    new Ip2RegionProvider(),
    new IplocateProvider(),
    new IpLocationDbProvider(),
    new CirclProvider(),
  ];
  return providers;
}

export function resetProviders(): void {
  providers = undefined;
  resetCache();
}

async function queryProvider(provider: IpProvider, ip: string): Promise<ProviderResult> {
  const started = performance.now();
  try {
    const location = await provider.lookup(ip);
    return {
      name: provider.name,
      attribution: provider.attribution,
      location,
      latencyMs: Math.round(performance.now() - started),
      error: false,
    };
  } catch {
    return {
      name: provider.name,
      attribution: provider.attribution,
      location: null,
      latencyMs: Math.round(performance.now() - started),
      error: true,
    };
  }
}

export async function lookupIp(ip: string | null, detail = false): Promise<LookupResult | null> {
  const parsed = parseClientIp(ip);
  if (!parsed) return null;

  const cached = getCached(parsed.ip);
  if (cached) {
    return buildResult(parsed.ip, parsed.version, cached, detail);
  }

  const allProviders = getProviders();
  const results = await Promise.all(allProviders.map((p) => queryProvider(p, parsed.ip)));

  const allFailed = results.every((r) => r.error);
  if (allFailed) {
    throw new Error("all providers failed");
  }

  const lookup: CachedLookup = { results };
  setCached(parsed.ip, lookup);

  return buildResult(parsed.ip, parsed.version, lookup, detail);
}

function buildResult(
  ip: string,
  version: 4 | 6,
  cached: CachedLookup,
  detail: boolean,
): LookupResult {
  const selection = selectBest(cached.results);
  const totalLatency = Math.max(...cached.results.map((r) => r.latencyMs));
  const attribution = cached.results.filter((r) => r.location !== null).map((r) => r.attribution);

  const result: LookupResult = {
    ip,
    version,
    location: selection?.location ?? null,
    source: selection?.source ?? "",
    attribution,
    latencyMs: totalLatency,
  };

  if (detail) {
    result.providers = cached.results;
  }

  return result;
}
