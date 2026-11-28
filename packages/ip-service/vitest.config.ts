import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "node_modules/.cache/vitest",
  test: {
    allowOnly: false,
    passWithNoTests: false,
    globals: false,
    pool: "threads",
    // Unit tests only — e2e tests live under tests/e2e and are run via test:e2e.
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      // Vitest v4 uses AST-aware remapping by default; no flag required.
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "**/index.ts",
        // Pure TypeScript interfaces (IpLocation, IpProvider).
        "src/services/ipProvider.ts",
        // Entry point — boots the Bun HTTP server. Pure side-effect module
        // (Bun.serve), exercised by E2E tests rather than unit tests.
        "src/index.ts",
        // Re-export of package.json version field — no runtime branches.
        "src/lib/version.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
