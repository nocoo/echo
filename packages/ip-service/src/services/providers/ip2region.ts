import type { IpProvider, IpLocation } from "../ipProvider.js";
import { getClient } from "../ipdb.js";

export class Ip2RegionProvider implements IpProvider {
  readonly name = "ip2region";
  readonly attribution =
    "IP2Region data provided by https://ip2region.net (Apache-2.0).";

  async lookup(ip: string): Promise<IpLocation | null> {
    const isV6 = ip.includes(":");
    const client = await getClient(isV6 ? "v6" : "v4");
    const region = await client.search(ip);
    return parseRegion(region);
  }
}

export function parseRegion(region: string): IpLocation {
  const [country, province, city, isp, iso2] = region.split("|");

  return {
    country: country ?? "",
    countryCode: iso2 ?? "",
    province: province ?? "",
    city: city ?? "",
    latitude: null,
    longitude: null,
    isp: isp ?? "",
    asn: null,
    asOrg: "",
  };
}
