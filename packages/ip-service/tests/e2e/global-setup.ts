import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const v4Path = path.join(dataDir, "ip2region_v4.xdb");
const v6Path = path.join(dataDir, "ip2region_v6.xdb");

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

export default async function setup() {
  if ((await exists(v4Path)) && (await exists(v6Path))) {
    return;
  }

  const result = spawnSync("bun", ["run", "ipdb:fetch"], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`ipdb:fetch failed with status ${result.status}`);
  }
}
