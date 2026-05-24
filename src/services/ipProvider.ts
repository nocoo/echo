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
