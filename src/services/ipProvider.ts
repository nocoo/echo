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
