import type { IpLocation, IpProvider } from "../ipProvider.js";
import { openMmdb } from "./mmdb.js";

interface IplocateAsnRecord {
  autonomous_system_number?: number;
  autonomous_system_organization?: string;
  domain?: string;
  country_code?: string;
}

interface IplocateCountryRecord {
  continent_code?: string;
  country_code?: string;
  country_name?: string;
}

export class IplocateProvider implements IpProvider {
  readonly name = "iplocate";
  readonly attribution = "IPLocate data provided by https://iplocate.io (CC BY-SA 4.0).";

  async lookup(ip: string): Promise<IpLocation | null> {
    const [asnReader, countryReader] = await Promise.all([
      openMmdb("iplocate-asn.mmdb"),
      openMmdb("iplocate-country.mmdb"),
    ]);

    const asnResult = asnReader.get(ip) as IplocateAsnRecord | null;
    const countryResult = countryReader.get(ip) as IplocateCountryRecord | null;

    if (!asnResult && !countryResult) return null;

    return {
      country: countryResult?.country_name ?? "",
      countryCode: countryResult?.country_code ?? asnResult?.country_code ?? "",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: asnResult?.autonomous_system_number ?? null,
      asOrg: asnResult?.autonomous_system_organization ?? "",
    };
  }
}
