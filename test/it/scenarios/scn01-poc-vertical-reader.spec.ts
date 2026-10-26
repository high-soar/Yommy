import { test, expect } from "@playwright/test";

test.describe("SCN-01: 縦書きリーダー実証とローカル永続化シナリオ", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("作品登録から続きから読む、縦書き・ルビ表示、設定変更、リロード復元、本棚戻りまでの一連の動作が正常に機能する", async ({
    page,
  }) => {
    // 1. 初期表示（/）で本棚の空状態（bookshelf-empty）が表示されることを確認
    const emptyState = page.getByTestId("bookshelf-empty");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("本棚に作品が登録されていません");

    // 2. 「URLから作品を追加」ダイアログを開き、URLを入力（サンプルURL自動入力）して登録を実行
    const openAddButton = page.getByTestId("open-add-novel-button");
    await expect(openAddButton).toBeVisible();
    await openAddButton.click();

    const dialog = page.getByTestId("add-novel-dialog");
    await expect(dialog).toBeVisible();

    const fillSampleButton = page.getByTestId("fill-sample-url-button");
    await expect(fillSampleButton).toBeVisible();
    await fillSampleButton.click();

    const submitButton = page.getByTestId("add-novel-submit-button");
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // ダイアログが閉じ、本棚に作品カードが表示されることを確認
    await expect(dialog).not.toBeVisible();

    const novelCard = page.getByTestId("novel-card");
    await expect(novelCard).toBeVisible();
    await expect(page.getByTestId("novel-card-title")).toHaveText(
      "境界迷宮と異界の魔術師",
    );
    await expect(page.getByTestId("novel-card-author")).toHaveText("小野崎");
    await expect(page.getByTestId("novel-card-chapters")).toContainText(
      "全 2 話（取得済み 0 話）",
    );

    // 3. 作品カードの「続きから読む」ボタン（novel-card-resume）をクリックし、リーダー画面へ遷移
    const resumeButton = page.getByTestId("novel-card-resume");
    await expect(resumeButton).toBeVisible();
    await resumeButton.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );

    // 4. 第1話本文がオンデマンド取得され、タイトル・サブタイトル・reader-view が表示されることを確認
    const readerTitle = page.getByTestId("reader-title");
    await expect(readerTitle).toBeVisible();
    await expect(readerTitle).toHaveText("境界迷宮と異界の魔術師");

    const chapterTitle = page.getByTestId("reader-chapter-title");
    await expect(chapterTitle).toBeVisible();
    await expect(chapterTitle).toHaveText("プロローグ：目覚め");

    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();

    // 5. 初期表示が縦書き（writing-vertical-rl）であることを確認
    await expect(readerView).toHaveClass(/writing-vertical-rl/);

    // 6. 本文内の <ruby>（ルビ）および <em class="bouten">（傍点）が可視状態で正しくレンダリングされていることを確認
    const rubyElement = readerView.locator("ruby").first();
    await expect(rubyElement).toBeVisible();

    const boutenElement = readerView.locator("em.bouten").first();
    await expect(boutenElement).toBeVisible();
    await expect(boutenElement).toHaveText("信じがたい光景");

    // 7. テーマを「セピア」に変更し、背景スタイルが反映されることを確認
    const sepiaButton = page.getByTestId("theme-sepia");
    await sepiaButton.click();
    await expect(readerView).toHaveClass(/bg-\[#fbf0d9\]/);

    // 8. 組み方向を「横書き」に変更し、writing-horizontal-tb が反映されることを確認
    const toggleButton = page.getByTestId("toggle-orientation");
    await toggleButton.click();
    await expect(readerView).toHaveClass(/writing-horizontal-tb/);

    // 9. ブラウザをリロード（F5）し、再取得操作を行うことなく、即座に作品・本文および変更後の設定（横書き・セピア）が復元表示されることを確認
    await page.reload();

    await expect(page.getByTestId("reader-title")).toBeVisible();
    await expect(page.getByTestId("reader-title")).toHaveText(
      "境界迷宮と異界の魔術師",
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );

    const restoredReaderView = page.getByTestId("reader-view");
    await expect(restoredReaderView).toHaveClass(/writing-horizontal-tb/);
    await expect(restoredReaderView).toHaveClass(/bg-\[#fbf0d9\]/);

    // 10. 「本棚へ戻る」（reader-back-to-bookshelf）をクリックして本棚画面（/）へ戻り、作品カードの取得済み話数が 1 に更新されていることを確認
    const backButton = page.getByTestId("reader-back-to-bookshelf");
    await expect(backButton).toBeVisible();
    await backButton.click();

    await expect(page.getByTestId("bookshelf-page")).toBeVisible();
    const updatedChapters = page.getByTestId("novel-card-chapters");
    await expect(updatedChapters).toContainText("全 2 話（取得済み 1 話）");
  });
});
