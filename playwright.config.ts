import { defineConfig, devices } from "@playwright/test";

const webkitExecutablePath = process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH;
const enableWebKit = Boolean(webkitExecutablePath || process.env.PLAYWRIGHT_WEBKIT);

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
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 400, height: 720 },
        channel: undefined,
        launchOptions: {
          executablePath:
            process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
            process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
    ...(enableWebKit
      ? [{
          name: "mobile-webkit",
          use: {
            ...devices["iPhone 13"],
            launchOptions: {
              executablePath: webkitExecutablePath,
            },
          },
        }]
      : []),
  ],
});
