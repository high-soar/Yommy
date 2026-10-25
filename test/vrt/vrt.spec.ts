import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface StoryEntry {
  id: string;
  title: string;
  name: string;
  type?: string;
  tags?: string[];
}

interface StorybookIndex {
  entries?: Record<string, StoryEntry>;
  stories?: Record<string, StoryEntry>;
}

const indexPath = path.resolve(process.cwd(), "storybook-static/index.json");
const indexData: StorybookIndex = fs.existsSync(indexPath)
  ? JSON.parse(fs.readFileSync(indexPath, "utf-8"))
  : { entries: {} };

const rawEntries = indexData.entries || indexData.stories || {};
const stories = Object.values(rawEntries).filter(
  (entry) => entry.type !== "docs" && !entry.tags?.includes("skip-vrt"),
);

const viewports = [
  { name: "1280px", width: 1280, height: 800 },
  { name: "375px", width: 375, height: 667 },
];

test.describe("Storybook VRT (1280px / 375px)", () => {
  test("Storybook index にストーリーが存在すること（0件空振り防止）", () => {
    expect(stories.length).toBeGreaterThan(0);
  });

  for (const story of stories) {
    for (const viewport of viewports) {
      test(`${story.id} [${viewport.name}]`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        await page.goto(
          `/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`,
          { waitUntil: "networkidle" },
        );

        const root = page.locator("#storybook-root");
        await expect(root).toBeVisible();

        await page.evaluate(() => document.fonts.ready);
        await root.locator(":scope > *").first().waitFor({ state: "visible" });

        await expect(page).toHaveScreenshot(
          `${story.id}-${viewport.name}.png`,
          {
            maxDiffPixelRatio: 0.01,
            animations: "disabled",
          },
        );
      });
    }
  }
});
