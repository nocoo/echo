import type { IpLocation, IpProvider } from "../ipProvider.js";
import { openMmdb } from "./mmdb.js";

interface IpLocationDbAsnRecord {
  autonomous_system_number?: number;
  autonomous_system_organization?: string;
}

interface IpLocationDbCityRecord {
  country?: { iso_code?: string; names?: { en?: string } };
  subdivisions?: { names?: { en?: string } }[];
  city?: { names?: { en?: string } };
  location?: { latitude?: number; longitude?: number };
}

export class IpLocationDbProvider implements IpProvider {
  readonly name = "ip-location-db";
  readonly attribution =
    "ip-location-db data provided by https://github.com/sapics/ip-location-db (CC BY-SA 4.0).";

  async lookup(ip: string): Promise<IpLocation | null> {
    const [asnReader, cityReader] = await Promise.all([
      openMmdb("ip-location-db-asn.mmdb"),
      openMmdb("ip-location-db-city.mmdb"),
    ]);

    const asnResult = asnReader.get(ip) as IpLocationDbAsnRecord | null;
    const cityResult = cityReader.get(ip) as IpLocationDbCityRecord | null;

    if (!asnResult && !cityResult) return null;

    return {
      country: cityResult?.country?.names?.en ?? "",
      countryCode: cityResult?.country?.iso_code ?? "",
      province: cityResult?.subdivisions?.[0]?.names?.en ?? "",
      city: cityResult?.city?.names?.en ?? "",
      latitude: cityResult?.location?.latitude ?? null,
      longitude: cityResult?.location?.longitude ?? null,
      isp: "",
      asn: asnResult?.autonomous_system_number ?? null,
      asOrg: asnResult?.autonomous_system_organization ?? "",
    };
  }
}
