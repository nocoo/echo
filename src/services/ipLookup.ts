import { createProvider, type IpLocation, type IpProvider } from "./ipProvider.js";
import { parseClientIp } from "../utils/ip.js";

export type { IpLocation };

export type LookupResult = {
  ip: string;
  version: 4 | 6;
  location: IpLocation | null;
  source: string;
  attribution: string;
};

let provider: IpProvider | undefined;

export function getProvider(): IpProvider {
  if (!provider) provider = createProvider();
  return provider;
}

export function resetProvider(): void {
  provider = undefined;
}

export async function lookupIp(ip: string | null): Promise<LookupResult | null> {
  const parsed = parseClientIp(ip);

  if (!parsed) {
    return null;
  }

  const p = getProvider();
  const location = await p.lookup(parsed.ip);

  return {
    ip: parsed.ip,
    version: parsed.version,
    location,
    source: p.name,
    attribution: p.attribution,
  };
}
