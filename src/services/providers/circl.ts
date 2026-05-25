import path from "node:path";
import type { IpProvider, IpLocation } from "../ipProvider.js";
import { openMmdb } from "./mmdb.js";

const dataDir = process.env.IPDB_DIR ?? "data";

type CirclRecord = {
  country?: { iso_code?: string };
  autonomous_system_number?: number;
  autonomous_system_organization?: string;
};

export class CirclProvider implements IpProvider {
  readonly name = "circl";
  readonly attribution =
    "CIRCL data provided by https://www.circl.lu (open data).";

  async lookup(ip: string): Promise<IpLocation | null> {
    const dbPath = path.join(process.cwd(), dataDir, "circl-country-asn.mmdb");
    const reader = await openMmdb(dbPath);
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
