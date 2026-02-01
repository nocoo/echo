import path from "node:path";
import { mkdir } from "node:fs/promises";

type IpdbType = "v4" | "v6";

const DEFAULT_URLS: Record<IpdbType, string> = {
  v4: "https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v4.xdb",
  v6: "https://raw.githubusercontent.com/lionsoul2014/ip2region/master/data/ip2region_v6.xdb",
};

const dataDir = process.env.IPDB_DIR ?? "data";
const targets: Array<{ type: IpdbType; url: string; filename: string }> = [
  {
    type: "v4",
    url: process.env.IPDB_URL_V4 ?? DEFAULT_URLS.v4,
    filename: "ip2region_v4.xdb",
  },
  {
    type: "v6",
    url: process.env.IPDB_URL_V6 ?? DEFAULT_URLS.v6,
    filename: "ip2region_v6.xdb",
  },
];

await mkdir(dataDir, { recursive: true });

for (const target of targets) {
  const filePath = path.join(dataDir, target.filename);
  const res = await fetch(target.url);

  if (!res.ok) {
    throw new Error(`failed to download ${target.type}: ${res.status}`);
  }

  const buffer = new Uint8Array(await res.arrayBuffer());

  if (buffer.byteLength === 0) {
    throw new Error(`empty download for ${target.type}`);
  }

  await Bun.write(filePath, buffer);
  console.log(`downloaded ${target.type} xdb to ${filePath}`);
}
