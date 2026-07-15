import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", extraHTTPHeaders: { "oai-authenticated-user-id": "surface-lab-test-user", "oai-authenticated-user-issuer": "local-e2e" } },
  webServer: { command: "npm run dev --workspace @buildmates/web -- --port 3100", url: "http://localhost:3100", reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } }, { name: "chromium-phone", use: { ...devices["Pixel 7"] } }],
});
