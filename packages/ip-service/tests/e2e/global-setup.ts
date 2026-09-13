import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const requiredFiles = [
  "ip2region_v4.xdb",
  "ip2region_v6.xdb",
  "iplocate-asn.mmdb",
  "iplocate-country.mmdb",
  "ip-location-db-asn.mmdb",
  "ip-location-db-city.mmdb",
  ...(process.env.IPDB_SKIP_CIRCL === "1" ? [] : ["circl-country-asn.mmdb"]),
];

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export default async function setup() {
  if (
    (await Promise.all(requiredFiles.map((file) => exists(path.join(dataDir, file))))).every(
      Boolean,
    )
  ) {
    return;
  }

  const result = spawnSync("bun", ["run", "ipdb:fetch"], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`ipdb:fetch failed with status ${result.status}`);
  }
}
