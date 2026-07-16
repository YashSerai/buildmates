import { defineConfig, devices } from "@playwright/test";
const e2eEnvironment = { ...process.env, BUILDMATES_E2E: "1" };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: { command: "npm run dev --workspace @buildmates/web -- --port 3100", env: e2eEnvironment, url: "http://localhost:3100", reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } }, { name: "chromium-phone", use: { ...devices["Pixel 7"] } }],
});
