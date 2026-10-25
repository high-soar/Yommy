import { test, expect } from "@playwright/test";

test.describe("アプリケーションスモーク結合テスト", () => {
  test("トップページが正常に読み込まれ、ヘッダーとリーダーUIが表示される", async ({
    page,
  }) => {
    await page.goto("/");

    // ヘッダータイトル表示の確認
    const title = page.getByTestId("app-title");
    await expect(title).toBeVisible();
    await expect(title).toHaveText("Yommy");

    // ツールバーの主要操作要素が表示されていることの確認
    const fetchButton = page.getByTestId("fetch-novel-button");
    await expect(fetchButton).toBeVisible();
    await expect(fetchButton).toHaveText("作品を取得/更新");

    const toggleButton = page.getByTestId("toggle-orientation");
    await expect(toggleButton).toBeVisible();

    // 初期状態（未登録状態）の案内メッセージ確認
    const emptyState = page.getByTestId("reader-empty");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("作品がまだ登録されていません。");
  });
});
