import { defineConfig, devices } from "@playwright/test";

const VRT_PORT = Number(process.env.VRT_PORT || 6007);

export default defineConfig({
  testDir: "./test/vrt",
  snapshotPathTemplate: "{testDir}/snapshots/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${VRT_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node scripts/serve-storybook.mjs",
    port: VRT_PORT,
    reuseExistingServer: !process.env.CI,
  },
});
