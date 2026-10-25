import { test, expect } from "@playwright/test";

test.describe("SCN-01: 縦書きリーダー実証とローカル永続化シナリオ", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("作品取得から縦書き・ルビ表示、設定変更、リロード復元まで一連の動作が正常に機能する", async ({
    page,
  }) => {
    // 1. 初期表示（未登録状態）の確認
    const emptyState = page.getByTestId("reader-empty");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("作品がまだ登録されていません。");

    // 2. 「作品を取得/更新」ボタンをクリック
    const fetchButton = page.getByTestId("fetch-novel-button");
    await expect(fetchButton).toBeEnabled();
    await fetchButton.click();

    // 3. 作品データが取得・DB保存されリーダー表示に切り替わることを確認
    const readerTitle = page.getByTestId("reader-title");
    await expect(readerTitle).toBeVisible();
    await expect(readerTitle).toHaveText("境界迷宮と異界の魔術師");

    const chapterTitle = page.getByTestId("reader-chapter-title");
    await expect(chapterTitle).toBeVisible();
    await expect(chapterTitle).toHaveText("プロローグ：目覚め");

    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();
    // 初期表示は縦書き（writing-vertical-rl）
    await expect(readerView).toHaveClass(/writing-vertical-rl/);

    // ルビ（<ruby>要素）および傍点（<em class="bouten">要素）が存在することを確認
    const rubyElement = readerView.locator("ruby").first();
    await expect(rubyElement).toBeVisible();

    const boutenElement = readerView.locator("em.bouten").first();
    await expect(boutenElement).toBeVisible();
    await expect(boutenElement).toHaveText("信じがたい光景");

    // 4. カラーテーマを「セピア」に変更
    const sepiaButton = page.getByTestId("theme-sepia");
    await sepiaButton.click();
    await expect(readerView).toHaveClass(/bg-\[#fbf0d9\]/);

    // 5. 組み方向を「横書き」に変更
    const toggleButton = page.getByTestId("toggle-orientation");
    await toggleButton.click();
    await expect(readerView).toHaveClass(/writing-horizontal-tb/);

    // 6. 再度「縦書き」に戻す
    await toggleButton.click();
    await expect(readerView).toHaveClass(/writing-vertical-rl/);

    // 7. ブラウザをリロード（localStorage からの SQLite DB 復元実証）
    await page.reload();

    // 8. 再度取得ボタンを押すことなく、即座に作品と話が復元されていることを確認
    await expect(page.getByTestId("reader-title")).toBeVisible();
    await expect(page.getByTestId("reader-title")).toHaveText(
      "境界迷宮と異界の魔術師",
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );

    // 設定（縦書き・セピア）も維持されていることを確認
    const restoredReaderView = page.getByTestId("reader-view");
    await expect(restoredReaderView).toHaveClass(/writing-vertical-rl/);
    await expect(restoredReaderView).toHaveClass(/bg-\[#fbf0d9\]/);
  });
});
