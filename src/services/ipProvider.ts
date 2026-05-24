import { Ip2RegionProvider } from "./providers/ip2region.js";

export type IpLocation = {
  country: string;
  province: string;
  city: string;
  isp: string;
  iso2: string;
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
