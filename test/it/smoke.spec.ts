import { test, expect } from "@playwright/test";

test.describe("アプリケーションスモーク結合テスト", () => {
  test("トップページが正常に読み込まれ、ヘッダーと本棚UI（空状態）が表示される", async ({
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

    // 下部タブバーが表示されていることの確認
    const bottomTabBar = page.getByTestId("bottom-tab-bar");
    await expect(bottomTabBar).toBeVisible();

    // 「URLから作品を追加」ボタンが表示されていることの確認
    const addNovelButton = page.getByTestId("open-add-novel-button");
    await expect(addNovelButton).toBeVisible();
    await expect(addNovelButton).toContainText("URLから作品を追加");

    // 初期状態（未登録状態）の案内メッセージ確認
    const emptyState = page.getByTestId("bookshelf-empty");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("本棚に作品が登録されていません");
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
