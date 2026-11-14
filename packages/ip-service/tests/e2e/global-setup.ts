import { spawnSync } from "node:child_process";
import path from "node:path";

export default function setup() {
  const result = spawnSync("bun", ["run", "build"], {
    cwd: path.resolve(process.cwd(), "../dashboard"),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`dashboard build failed with status ${result.status}`);
  }
}
