import { defineConfig } from "vitest/config";
import ipServicePackage from "../ip-service/package.json";

export default defineConfig({
  cacheDir: "node_modules/.cache/vitest",
  define: {
    __ECHO_VERSION__: JSON.stringify(ipServicePackage.version),
  },
  test: {
    globals: false,
    environment: "jsdom",
    pool: "threads",
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    setupFiles: ["tests/unit/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/app/**/use-*.ts"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/*.d.ts"],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
