import { Ip2RegionProvider } from "./providers/ip2region.js";

export type IpLocation = {
  country: string;
  countryCode: string;
  province: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  isp: string;
  asn: number | null;
  asOrg: string;
};

export interface IpProvider {
  readonly name: string;
  readonly attribution: string;
  lookup(ip: string): Promise<IpLocation | null>;
}

export function createProvider(name?: string): IpProvider {
  const selected = name ?? process.env.IP_PROVIDER ?? "ip2region";
  switch (selected) {
    case "ip2region":
      return new Ip2RegionProvider();
    default:
      throw new Error(`Unknown IP provider: ${selected}`);
  }
}
