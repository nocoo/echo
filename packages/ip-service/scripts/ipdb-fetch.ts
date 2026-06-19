import path from "node:path";
import { mkdir } from "node:fs/promises";

interface Source {
  name: string;
  url: string;
  minSize: number;
}

const SOURCES: Source[] = [
  {
    name: "ip2region_v4.xdb",
    url: "https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v4.xdb",
    minSize: 1_000_000,
  },
  {
    name: "ip2region_v6.xdb",
    url: "https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v6.xdb",
    minSize: 500_000,
  },
  {
    name: "iplocate-asn.mmdb",
    url: "https://github.com/iplocate/ip-address-databases/raw/main/ip-to-asn/ip-to-asn.mmdb",
    minSize: 1_000_000,
  },
  {
    name: "iplocate-country.mmdb",
    url: "https://github.com/iplocate/ip-address-databases/raw/main/ip-to-country/ip-to-country.mmdb",
    minSize: 500_000,
  },
  {
    name: "ip-location-db-asn.mmdb",
    url: "https://cdn.jsdelivr.net/npm/@ip-location-db/asn-mmdb/asn.mmdb",
    minSize: 1_000_000,
  },
  {
    name: "ip-location-db-city.mmdb",
    url: "https://github.com/sapics/ip-location-db/releases/latest/download/dbip-city-ipv4.mmdb",
    minSize: 5_000_000,
  },
  {
    name: "circl-country-asn.mmdb",
    url: "https://cra.circl.lu/opendata/geo-open/mmdb-country-asn/latest.mmdb",
    minSize: 1_000_000,
  },
];

const dataDir = process.env.IPDB_DIR ?? "data";
const maxRetries = 3;
const verify = process.argv.includes("--verify");

async function downloadWithRetry(source: Source): Promise<void> {
  const filePath = path.join(dataDir, source.name);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(source.url);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const buffer = new Uint8Array(await res.arrayBuffer());

      if (buffer.byteLength < source.minSize) {
        throw new Error(
          `file too small: ${buffer.byteLength} bytes (min ${source.minSize})`,
        );
      }

      await Bun.write(filePath, buffer);
      console.log(
        `✓ ${source.name} (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB)`,
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === maxRetries) {
        throw new Error(
          `failed to download ${source.name} after ${maxRetries} attempts: ${msg}`,
          { cause: err },
        );
      }
      console.warn(`⚠ ${source.name} attempt ${attempt} failed: ${msg}, retrying...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

await mkdir(dataDir, { recursive: true });

console.log(`Downloading ${SOURCES.length} database files to ${dataDir}/\n`);

const results = await Promise.allSettled(SOURCES.map(downloadWithRetry));

const failed = results.filter((r) => r.status === "rejected");
if (failed.length > 0) {
  console.error(`\n✗ ${failed.length} download(s) failed:`);
  for (const f of failed) {
    console.error(`  - ${(f as PromiseRejectedResult).reason}`);
  }
  process.exit(1);
}

console.log(`\n✓ All ${SOURCES.length} files downloaded successfully.`);

if (verify) {
  console.log("\nVerifying databases...");
  const maxmind = await import("maxmind");

  for (const source of SOURCES) {
    const filePath = path.join(process.cwd(), dataDir, source.name);

    if (source.name.endsWith(".mmdb")) {
      try {
        const reader = await maxmind.default.open(filePath);
        const result = reader.get("1.1.1.1");
        console.log(`  ✓ ${source.name}: ${result ? "data found" : "no data for 1.1.1.1 (may be normal)"}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ ${source.name}: ${msg}`);
        process.exit(1);
      }
    } else {
      console.log(`  ✓ ${source.name}: skipped (xdb format)`);
    }
  }

  console.log("\n✓ All databases verified.");
}
