import { mkdtempSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

if (!process.env.ECHO_E2E_PORT) {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing browser fixture port");
  process.env.ECHO_E2E_PORT = String(address.port);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
const port = process.env.ECHO_E2E_PORT;
process.env.ECHO_BROWSER_ROOT ??= mkdtempSync(path.join(tmpdir(), "echo-browser-"));
const runRoot = process.env.ECHO_BROWSER_ROOT;
const buildDir = JSON.stringify(path.join(runRoot, "dist"));

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  outputDir: path.join(runRoot, "results"),
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `bun run build --outDir ${buildDir} --emptyOutDir && bun run vite preview --outDir ${buildDir} --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/admin/`,
    reuseExistingServer: false,
  },
});
