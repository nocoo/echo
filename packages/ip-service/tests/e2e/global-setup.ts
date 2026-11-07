import { spawnSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";

const packageRoot = process.cwd();
const dataDir = path.join(packageRoot, "data");
const dashboardDir = path.resolve(packageRoot, "../dashboard");
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

async function ensureDatabases(): Promise<void> {
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

function buildDashboard(): void {
  const result = spawnSync("bun", ["run", "build"], {
    cwd: dashboardDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`dashboard build failed with status ${result.status}`);
  }
}

export default async function setup() {
  await ensureDatabases();
  buildDashboard();
}
