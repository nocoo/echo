import path from "node:path";
import type { IpProvider, IpLocation } from "../ipProvider.js";
import { openMmdb } from "./mmdb.js";

const dataDir = process.env.IPDB_DIR ?? "data";

type IplocateAsnRecord = {
  autonomous_system_number?: number;
  autonomous_system_organization?: string;
  domain?: string;
  country_code?: string;
};

type IplocateCountryRecord = {
  continent_code?: string;
  country_code?: string;
  country_name?: string;
};

export class IplocateProvider implements IpProvider {
  readonly name = "iplocate";
  readonly attribution =
    "IPLocate data provided by https://iplocate.io (CC BY-SA 4.0).";

  async lookup(ip: string): Promise<IpLocation | null> {
    const asnPath = path.join(process.cwd(), dataDir, "iplocate-asn.mmdb");
    const countryPath = path.join(process.cwd(), dataDir, "iplocate-country.mmdb");

    const [asnReader, countryReader] = await Promise.all([
      openMmdb(asnPath),
      openMmdb(countryPath),
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
