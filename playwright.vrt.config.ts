import { defineConfig, devices } from "@playwright/test";

function computeWorkspacePort(base: number, span: number): number {
  let hash = 2166136261;
  const cwd = process.cwd();
  for (let i = 0; i < cwd.length; i += 1) {
    hash ^= cwd.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return base + ((hash >>> 0) % span);
}

const VRT_PORT =
  Number(process.env.VRT_PORT) || computeWorkspacePort(51000, 9000);
const VRT_ENV = Object.fromEntries(
  Object.entries({ ...process.env, VRT_PORT: String(VRT_PORT) }).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

export default defineConfig({
  testDir: "./test/vrt",
  snapshotPathTemplate: "{testDir}/snapshots/{arg}{ext}",
  fullyParallel: true,
  workers: 2,
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
    reuseExistingServer: false,
    env: VRT_ENV,
  },
});
