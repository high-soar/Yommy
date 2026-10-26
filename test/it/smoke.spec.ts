import { test, expect } from "@playwright/test";

test.describe("アプリケーションスモーク結合テスト", () => {
  test("トップページが正常に読み込まれ、ヘッダーと本棚UI（空状態）が表示される", async ({
    page,
  }) => {
    await page.goto("/");

    // ヘッダータイトル表示の確認
    const title = page.getByTestId("app-title");
    await expect(title).toBeVisible();
    await expect(title).toHaveText("Yommy");

    // 本棚ページが表示されていることの確認
    const bookshelfPage = page.getByTestId("bookshelf-page");
    await expect(bookshelfPage).toBeVisible();

    // 「URLから作品を追加」ボタンが表示されていることの確認
    const addNovelButton = page.getByTestId("open-add-novel-button");
    await expect(addNovelButton).toBeVisible();
    await expect(addNovelButton).toContainText("URLから作品を追加");

    // 初期状態（未登録状態）の案内メッセージ確認
    const emptyState = page.getByTestId("bookshelf-empty");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("本棚に作品が登録されていません");
  });
});
