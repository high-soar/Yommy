import { test, expect } from "@playwright/test";

test.describe("アプリケーションスモーク結合テスト", () => {
  test("トップページが正常に読み込まれ、全画面シェル・下部タブバー・本棚UI（空状態）が表示される", async ({
    page,
  }) => {
    await page.goto("/");

    // 全画面シェルおよび本棚ヘッダー表示の確認
    const appRoot = page.getByTestId("app-root");
    await expect(appRoot).toBeVisible();

    // 本棚ページが表示されていることの確認
    const bookshelfPage = page.getByTestId("bookshelf-page");
    await expect(bookshelfPage).toBeVisible();
    await expect(bookshelfPage.locator("h1")).toHaveText("本棚");

    // 下部タブバーおよび4タブ（本棚・検索・ランキング・設定）が表示されていることの確認
    const bottomTabBar = page.getByTestId("bottom-tab-bar");
    await expect(bottomTabBar).toBeVisible();

    const tabBookshelf = page.getByTestId("tab-bookshelf");
    const tabSearch = page.getByTestId("tab-search");
    const tabRanking = page.getByTestId("tab-ranking");
    const tabSettings = page.getByTestId("tab-settings");

    await expect(tabBookshelf).toBeVisible();
    await expect(tabSearch).toBeVisible();
    await expect(tabRanking).toBeVisible();
    await expect(tabSettings).toBeVisible();
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    // 初期状態（未登録状態）の案内メッセージおよび誘導ボタン確認
    const emptyState = page.getByTestId("bookshelf-empty");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("本棚に作品が登録されていません");

    const emptySearchButton = page.getByTestId("empty-search-button");
    await expect(emptySearchButton).toBeVisible();
    await expect(emptySearchButton).toContainText("小説を検索する");

    const emptyRankingButton = page.getByTestId("empty-ranking-button");
    await expect(emptyRankingButton).toBeVisible();
    await expect(emptyRankingButton).toContainText("ランキングを見る");
  });

  test("Favicon および Web アイコンの link タグが存在し、各アセットが HTTP 200 で解決される", async ({
    page,
    request,
  }) => {
    await page.goto("/");

    // Favicon / Web アイコンの link タグの存在と href 属性の確認
    const faviconLink = page.locator('link[rel="icon"][href="/favicon.ico"]');
    await expect(faviconLink).toHaveCount(1);
    await expect(faviconLink).toHaveAttribute("type", "image/x-icon");

    const icon192Link = page.locator(
      'link[rel="icon"][type="image/png"][sizes="192x192"]',
    );
    await expect(icon192Link).toHaveCount(1);
    await expect(icon192Link).toHaveAttribute("href", "/icon-192.png");

    const appleTouchLink = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleTouchLink).toHaveCount(1);
    await expect(appleTouchLink).toHaveAttribute(
      "href",
      "/apple-touch-icon.png",
    );
    await expect(appleTouchLink).toHaveAttribute("sizes", "180x180");

    // 各アセットの HTTP 200 応答検証
    const assetUrls = [
      "/favicon.ico",
      "/icon-192.png",
      "/icon-512.png",
      "/apple-touch-icon.png",
    ];

    for (const url of assetUrls) {
      const response = await request.get(url);
      expect(response.status()).toBe(200);
      const body = await response.body();
      expect(body.length).toBeGreaterThan(0);
    }
  });
});
