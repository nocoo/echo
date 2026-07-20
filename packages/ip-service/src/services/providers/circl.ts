import type { IpLocation, IpProvider } from "../ipProvider.js";
import { openMmdb } from "./mmdb.js";

interface CirclRecord {
  country?: { iso_code?: string };
  autonomous_system_number?: number;
  autonomous_system_organization?: string;
}

export class CirclProvider implements IpProvider {
  readonly name = "circl";
  readonly attribution = "CIRCL data provided by https://www.circl.lu (open data).";

  async lookup(ip: string): Promise<IpLocation | null> {
    const reader = await openMmdb("circl-country-asn.mmdb");
    const result = reader.get(ip) as CirclRecord | null;

    if (!result) return null;

    return {
      country: "",
      countryCode: result.country?.iso_code ?? "",
      province: "",
      city: "",
      latitude: null,
      longitude: null,
      isp: "",
      asn: result.autonomous_system_number ?? null,
      asOrg: result.autonomous_system_organization ?? "",
    };
  }
}
