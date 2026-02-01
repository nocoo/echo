import { getClient } from "./ipdb";
import { parseClientIp } from "../utils/ip";

export type IpLocation = {
  country: string;
  province: string;
  city: string;
  isp: string;
  iso2: string;
};

export type LookupResult = {
  ip: string;
  version: 4 | 6;
  location: IpLocation | null;
};

export async function lookupIp(ip: string | null): Promise<LookupResult | null> {
  const parsed = parseClientIp(ip);

  if (!parsed) {
    return null;
  }

  const client = await getClient(parsed.version === 4 ? "v4" : "v6");
  const region = await client.search(parsed.ip);
  const location = parseRegion(region);

  return {
    ip: parsed.ip,
    version: parsed.version,
    location,
  };
}

export function parseRegion(region: string): IpLocation {
  const [country, province, city, isp, iso2] = region.split("|");

  return {
    country: country ?? "",
    province: province ?? "",
    city: city ?? "",
    isp: isp ?? "",
    iso2: iso2 ?? "",
  };
}
