import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

export default function setup(project: TestProject) {
  const dashboardDir = mkdtempSync(path.join(tmpdir(), "echo-http-dashboard-"));
  const result = spawnSync("bun", ["run", "build", "--outDir", dashboardDir, "--emptyOutDir"], {
    cwd: path.resolve(process.cwd(), "../dashboard"),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    rmSync(dashboardDir, { recursive: true, force: true });
    throw new Error(`dashboard build failed with status ${result.status}`);
  }
  project.provide("dashboardDir", dashboardDir);
  return () => rmSync(dashboardDir, { recursive: true, force: true });
}
