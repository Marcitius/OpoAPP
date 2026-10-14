import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/ui",
  testMatch: "*.spec.ts",
  workers: 1,
  use: {
    headless: true,
    launchOptions: process.env.CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.CHROMIUM_EXECUTABLE,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : undefined,
  },
  webServer: [
    {
      command: "node scripts/serve-tests.mjs",
      url: "http://127.0.0.1:3001",
      reuseExistingServer: false,
    },
    {
      command: "npx vite --config vite.test.config.ts",
      url: "http://127.0.0.1:4175/tests/ui/index.html",
      reuseExistingServer: false,
    },
  ],
  reporter: [["list"], ["json", { outputFile: "test-results/ui-report.json" }]],
});
