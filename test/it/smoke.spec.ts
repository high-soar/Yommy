import { test, expect } from "@playwright/test";

test.describe("アプリケーションスモーク結合テスト", () => {
  test("トップページが正常に読み込まれ、ヘッダーと小説プレビューが表示される", async ({
    page,
  }) => {
    await page.goto("/");

    // タイトル表示の確認
    const title = page.getByTestId("app-title");
    await expect(title).toBeVisible();
    await expect(title).toHaveText("Yommy");

    // 初期状態（横書き）の確認
    const preview = page.getByTestId("novel-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toHaveClass(/writing-horizontal-tb/);

    // 切替ボタンで縦書きに切り替わることの確認
    const toggleButton = page.getByTestId("toggle-orientation");
    await toggleButton.click();
    await expect(preview).toHaveClass(/writing-vertical-rl/);

    // 再度クリックで横書きに戻ることの確認
    await toggleButton.click();
    await expect(preview).toHaveClass(/writing-horizontal-tb/);
  });
});
