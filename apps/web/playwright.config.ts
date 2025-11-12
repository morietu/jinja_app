// apps/web/playwright.config.ts
import { defineConfig, devices } from "@playwright/test";



const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        geolocation: { latitude: 35.681236, longitude: 139.767125 },
        permissions: ["geolocation"],
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        geolocation: { latitude: 35.681236, longitude: 139.767125 },
        permissions: ["geolocation"],
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL, // port を固定する代わりに URL を指定
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PLAYWRIGHT: "1",
      PLAYWRIGHT_BASE_URL: baseURL,
      // ✅ E2E は Next(3000)で自己完結
      NEXT_PUBLIC_API_BASE_URL: baseURL,
      // devのホットリロードでフルリロードが起きると遷移がキャンセルされるのを防ぐ
      NEXT_DISABLE_DEVELOPMENT_FAST_REFRESH: "1",
    },
  },
});
