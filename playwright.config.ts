import { defineConfig, devices } from "@playwright/test";
import { expectedAuthEnabled } from "./src/test/playwright-auth-mode";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
expectedAuthEnabled(process.env);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: { baseURL: externalBaseUrl || "http://127.0.0.1:4174", trace: "on-first-retry" },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm preview --host 127.0.0.1",
        url: "http://127.0.0.1:4174",
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
