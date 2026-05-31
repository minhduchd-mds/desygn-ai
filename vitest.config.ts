import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "shared/**/__tests__/**/*.test.ts",
      "ui/lib/__tests__/**/*.test.ts",
      "web/src/**/__tests__/**/*.test.ts",
      "plugin/**/__tests__/**/*.test.ts",
      "api/**/__tests__/**/*.test.ts",
      "sdk/**/__tests__/**/*.test.ts",
      "packages/**/__tests__/**/*.test.ts",
      "apps/**/__tests__/**/*.test.ts",
      "inngest/**/__tests__/**/*.test.ts",
    ],
    // Playwright e2e specs (*.spec.ts under e2e/) are NOT run by vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "plugin/**/*.ts",
        "ui/**/*.ts",
        "ui/**/*.tsx",
        "shared/**/*.ts",
        "web/src/**/*.ts",
        "web/src/**/*.tsx",
      ],
      exclude: [
        "**/__tests__/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/types.ts",
        "**/index.ts",
        "**/*.d.ts",
        "web/src/stories/**",
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 55,
        lines: 60,
      },
    },
  },
});
