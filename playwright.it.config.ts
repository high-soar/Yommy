import { defineConfig, devices } from "@playwright/test";

const IT_PORT = Number(process.env.IT_PORT || 5173);

export default defineConfig({
  testDir: "./test/it",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${IT_PORT}`,
    trace: "on",
    screenshot: "on",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${IT_PORT} --host 127.0.0.1`,
    port: IT_PORT,
    reuseExistingServer: !process.env.CI,
  },
});
