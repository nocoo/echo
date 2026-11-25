import { defineConfig } from "vitest/config";
import ipServicePackage from "../ip-service/package.json";

export default defineConfig({
  cacheDir: "node_modules/.cache/vitest",
  resolve: {
    dedupe: ["react", "react-dom", "@nocoo/basalt"],
  },
  define: {
    __ECHO_VERSION__: JSON.stringify(ipServicePackage.version),
  },
  test: {
    allowOnly: false,
    passWithNoTests: false,
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
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.d.ts",
        "src/components/**",
        "src/app/**/*.tsx",
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
