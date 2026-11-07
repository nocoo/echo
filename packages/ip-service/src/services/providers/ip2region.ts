import { getClient } from "../ipdb.js";
import type { IpLocation, IpProvider } from "../ipProvider.js";

export class Ip2RegionProvider implements IpProvider {
  readonly name = "ip2region";
  readonly attribution = "IP2Region data provided by https://ip2region.net (Apache-2.0).";

  async lookup(ip: string): Promise<IpLocation | null> {
    const isV6 = ip.includes(":");
    const client = await getClient(isV6 ? "v6" : "v4");
    const region = await client.search(ip);
    return parseRegion(region);
  }
}

function cleanField(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed === "0" ? "" : trimmed;
}

export function parseRegion(region: string): IpLocation {
  const [country, province, city, isp, iso2] = region.split("|");

  return {
    country: cleanField(country),
    countryCode: cleanField(iso2),
    province: cleanField(province),
    city: cleanField(city),
    latitude: null,
    longitude: null,
    isp: cleanField(isp),
    asn: null,
    asOrg: "",
  };
}
