import { test, expect } from "@playwright/test";

test.describe("SCN-01: 縦書きリーダー実証とローカル永続化シナリオ", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("作品登録からSCR-02目次確認・更新、リーダーオンデマンド取得、設定変更、リロード復元、SCR-02キャッシュ更新確認、作品削除までの一連の動作が正常に機能する", async ({
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
      "全 4 話（取得済み 0 話）",
    );

    // 3. 作品カード本体（novel-card-select）をクリックして /novels/:novelId（SCR-02 作品詳細・目次画面）へ遷移（TR-02）
    const novelCardSelect = page.getByTestId("novel-card-select");
    await expect(novelCardSelect).toBeVisible();
    await novelCardSelect.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    const novelDetailPage = page.getByTestId("novel-detail-page");
    await expect(novelDetailPage).toBeVisible();

    const detailTitle = page.getByTestId("novel-detail-title");
    await expect(detailTitle).toHaveText("境界迷宮と異界の魔術師");

    const detailStats = page.getByTestId("novel-detail-stats");
    await expect(detailStats).toContainText("全 4 話（取得済み 0 話）");

    // 章見出しが存在することを確認
    const sectionHeader = page.getByTestId("chapter-section-header").first();
    await expect(sectionHeader).toBeVisible();

    // エピソード一覧が表示され、未取得バッジが表示されていることを確認
    const episodeItems = page.getByTestId("episode-item");
    await expect(episodeItems).toHaveCount(4);
    const firstUncachedBadge = episodeItems
      .first()
      .getByTestId("episode-uncached-badge");
    await expect(firstUncachedBadge).toBeVisible();

    // 「目次を更新」ボタン押下で最新状態が通知されることを確認
    const refreshButton = page.getByTestId("refresh-toc-button");
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    const refreshNotice = page.getByTestId("novel-detail-notice");
    await expect(refreshNotice).toBeVisible();
    await expect(refreshNotice).toHaveText("最新の状態です");

    // 4. 目次一覧から第1話エピソード行を選択して /novels/:novelId/chapters/1（SCR-03）へ遷移（TR-04）
    await episodeItems.first().click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );

    // 5. 第1話本文がオンデマンド取得され、タイトル・サブタイトル・reader-view が表示されることを確認
    const readerTitle = page.getByTestId("reader-title");
    await expect(readerTitle).toBeVisible();
    await expect(readerTitle).toHaveText("境界迷宮と異界の魔術師");

    const chapterTitle = page.getByTestId("reader-chapter-title");
    await expect(chapterTitle).toBeVisible();
    await expect(chapterTitle).toHaveText("プロローグ：目覚め");

    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();

    // 6. 初期表示が縦書き（writing-vertical-rl）であることを確認
    await expect(readerView).toHaveClass(/writing-vertical-rl/);

    // 7. 本文内の <ruby>（ルビ）および <em class="bouten">（傍点）が可視状態で正しくレンダリングされていることを確認
    const rubyElement = readerView.locator("ruby").first();
    await expect(rubyElement).toBeVisible();

    const boutenElement = readerView.locator("em.bouten").first();
    await expect(boutenElement).toBeVisible();
    await expect(boutenElement).toHaveText("信じがたい光景");

    // 8. テーマを「セピア」に変更し、背景スタイルが反映されることを確認
    const sepiaButton = page.getByTestId("theme-sepia");
    await sepiaButton.click();
    await expect(readerView).toHaveClass(/bg-\[#fbf0d9\]/);

    // 9. 組み方向を「横書き」に変更し、writing-horizontal-tb が反映されることを確認
    const toggleButton = page.getByTestId("toggle-orientation");
    await toggleButton.click();
    await expect(readerView).toHaveClass(/writing-horizontal-tb/);

    // 10. ブラウザをリロード（F5）し、再取得操作を行うことなく、即座に作品・本文および変更後の設定（横書き・セピア）が復元表示されることを確認
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

    // 11. 「作品詳細へ」（reader-back-to-detail）をクリックして SCR-02 へ戻り（TR-06）、第1話が 取得済み バッジに、ヘッダーの取得済み話数が 1 に更新されていることを確認
    const backToDetailButton = page.getByTestId("reader-back-to-detail");
    await expect(backToDetailButton).toBeVisible();
    await backToDetailButton.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    await expect(page.getByTestId("novel-detail-page")).toBeVisible();
    const updatedDetailStats = page.getByTestId("novel-detail-stats");
    await expect(updatedDetailStats).toContainText("全 4 話（取得済み 1 話）");

    const updatedEpisodeItems = page.getByTestId("episode-item");
    const firstCachedBadge = updatedEpisodeItems
      .first()
      .getByTestId("episode-cached-badge");
    await expect(firstCachedBadge).toBeVisible();

    // 12. 「本棚へ戻る」（back-to-bookshelf-button）で本棚画面（/）へ戻り作品カードの取得済み話数が 1 に更新されていることを確認した上で、再度 SCR-02 から「作品を削除」→ 確認ダイアログの「削除する」を実行し、本棚（/）へ戻って空状態（bookshelf-empty）となることを確認（TR-07）
    const backToBookshelfButton = page.getByTestId("back-to-bookshelf-button");
    await expect(backToBookshelfButton).toBeVisible();
    await backToBookshelfButton.click();

    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();
    const bookshelfUpdatedChapters = page.getByTestId("novel-card-chapters");
    await expect(bookshelfUpdatedChapters).toContainText(
      "全 4 話（取得済み 1 話）",
    );

    // 再度 SCR-02 へ遷移
    await page.getByTestId("novel-card-select").click();
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();

    // 作品削除ボタンをクリック
    const openDeleteDialogButton = page.getByTestId(
      "open-delete-dialog-button",
    );
    await expect(openDeleteDialogButton).toBeVisible();
    await openDeleteDialogButton.click();

    const deleteDialog = page.getByTestId("delete-confirm-dialog");
    await expect(deleteDialog).toBeVisible();

    // 確認ダイアログの「削除する」を実行
    const confirmDeleteButton = page.getByTestId("confirm-delete-button");
    await expect(confirmDeleteButton).toBeVisible();
    await confirmDeleteButton.click();

    // 本棚（/）へ戻り空状態（bookshelf-empty）となることを確認
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-empty")).toBeVisible();
    await expect(page.getByTestId("novel-card")).not.toBeVisible();
  });
});
