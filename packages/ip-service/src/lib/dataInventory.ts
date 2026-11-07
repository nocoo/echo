import { stat } from "node:fs/promises";
import path from "node:path";
import maxmind from "maxmind";
import { DATA_MAX_AGE_DAYS } from "./dataVersion.js";

export interface DataManifestEntry {
  filename: string;
  provider: string;
  url: string;
}

export type DataStatus = "missing" | "ok" | "stale";

export interface DataInventoryEntry extends DataManifestEntry {
  present: boolean;
  size: number | null;
  modifiedAt: string | null;
  ageDays: number | null;
  buildDate: string | null;
  status: DataStatus;
}

export interface DataInventorySummary {
  present: number;
  missing: number;
  ageDays: number | null;
  stale: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const DATA_MANIFEST: readonly DataManifestEntry[] = [
  {
    filename: "ip2region_v4.xdb",
    provider: "ip2region",
    url: "https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v4.xdb",
  },
  {
    filename: "ip2region_v6.xdb",
    provider: "ip2region",
    url: "https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v6.xdb",
  },
  {
    filename: "iplocate-asn.mmdb",
    provider: "iplocate",
    url: "https://github.com/iplocate/ip-address-databases/raw/main/ip-to-asn/ip-to-asn.mmdb",
  },
  {
    filename: "iplocate-country.mmdb",
    provider: "iplocate",
    url: "https://github.com/iplocate/ip-address-databases/raw/main/ip-to-country/ip-to-country.mmdb",
  },
  {
    filename: "ip-location-db-asn.mmdb",
    provider: "ip-location-db",
    url: "https://cdn.jsdelivr.net/npm/@ip-location-db/asn-mmdb/asn.mmdb",
  },
  {
    filename: "ip-location-db-city.mmdb",
    provider: "ip-location-db",
    url: "https://github.com/sapics/ip-location-db/releases/latest/download/dbip-city-ipv4.mmdb",
  },
  {
    filename: "circl-country-asn.mmdb",
    provider: "circl",
    url: "https://cra.circl.lu/opendata/geo-open/mmdb-country-asn/latest.mmdb",
  },
];

export async function readDataInventory(
  dataDir: string = process.env.IPDB_DIR ?? "data",
): Promise<DataInventoryEntry[]> {
  const dir = path.resolve(dataDir);
  const entries: DataInventoryEntry[] = [];

  for (const manifest of DATA_MANIFEST) {
    entries.push(await readEntry(dir, manifest));
  }

  return entries;
}

export function summarizeInventory(entries: DataInventoryEntry[]): DataInventorySummary {
  const present = entries.filter((entry) => entry.present);
  const newest = present.reduce<number | null>((acc, entry) => {
    const time = entry.modifiedAt ? Date.parse(entry.modifiedAt) : Number.NaN;
    if (Number.isNaN(time)) return acc;
    return acc === null || time > acc ? time : acc;
  }, null);

  if (newest === null) {
    return {
      present: present.length,
      missing: entries.length - present.length,
      ageDays: null,
      stale: false,
    };
  }

  const ageMs = Date.now() - newest;
  return {
    present: present.length,
    missing: entries.length - present.length,
    ageDays: Math.max(0, Math.floor(ageMs / DAY_MS)),
    stale: ageMs > DATA_MAX_AGE_DAYS * DAY_MS,
  };
}

async function readEntry(dir: string, manifest: DataManifestEntry): Promise<DataInventoryEntry> {
  const filePath = path.join(dir, manifest.filename);

  try {
    const stats = await stat(filePath);
    const ageMs = Date.now() - stats.mtimeMs;
    const ageDays = Math.max(0, Math.floor(ageMs / DAY_MS));

    return {
      ...manifest,
      present: true,
      size: stats.size,
      modifiedAt: new Date(stats.mtimeMs).toISOString(),
      ageDays,
      buildDate: manifest.filename.endsWith(".mmdb") ? await readBuildDate(filePath) : null,
      status: ageMs > DATA_MAX_AGE_DAYS * DAY_MS ? "stale" : "ok",
    };
  } catch {
    return {
      ...manifest,
      present: false,
      size: null,
      modifiedAt: null,
      ageDays: null,
      buildDate: null,
      status: "missing",
    };
  }
}

async function readBuildDate(filePath: string): Promise<string | null> {
  try {
    const reader = await maxmind.open(filePath);
    const buildEpoch = reader.metadata.buildEpoch;
    if (!(buildEpoch instanceof Date)) return null;
    return buildEpoch.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
