import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: ".playwright/test-results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5000",
    trace: "on-first-retry",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 400, height: 720 },
        channel: undefined,
      },
    },
  ],
});
