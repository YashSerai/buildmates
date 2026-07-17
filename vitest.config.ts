import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    passWithNoTests: true,
    hookTimeout: 60_000,
    testTimeout: 60_000,
  },
});
