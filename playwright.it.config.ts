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

const IT_PORT =
  Number(process.env.IT_PORT) || computeWorkspacePort(41000, 9000);
const IT_ENV = Object.fromEntries(
  Object.entries({ ...process.env, IT_PORT: String(IT_PORT) }).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

export default defineConfig({
  testDir: "./test/it",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${IT_PORT}`,
    trace: "on-first-retry",
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
    reuseExistingServer: false,
    env: IT_ENV,
  },
});
