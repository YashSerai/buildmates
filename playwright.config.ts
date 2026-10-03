import { defineConfig, devices } from "@playwright/test";
const e2eEnvironment = {
  ...process.env,
  BUILDMATES_E2E: "1",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3100",
};
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
const chromiumLaunchOptions = chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: { command: "npm run db:migrate:local --workspace @buildmates/web && npm run dev --workspace @buildmates/web -- --port 3100", env: e2eEnvironment, url: "http://localhost:3100", reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: "chromium-desktop", use: { ...devices["Desktop Chrome"], ...chromiumLaunchOptions } }, { name: "chromium-phone", use: { ...devices["Pixel 7"], ...chromiumLaunchOptions } }],
});
