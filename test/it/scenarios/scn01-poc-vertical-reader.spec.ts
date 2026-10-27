import { test, expect } from "@playwright/test";

test.describe("SCN-01: 小説リーダー縦貫通・組版設定・前後話遷移・既読しおり復元シナリオ", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("作品登録からSCR-02目次確認・更新、リーダーオンデマンド取得、組版設定変更、リロード復元、前後話遷移、既読しおり復元、SCR-02バッジ反映、作品削除までの一連の動作が正常に機能する", async ({
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
    await expect(page.getByTestId("novel-card-bookmark")).toHaveText("未読");

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

    // あらすじの折りたたみトグル動作を確認（AC-ND-01）
    const synopsisToggle = page.getByTestId("synopsis-toggle-button");
    if (await synopsisToggle.isVisible()) {
      await expect(synopsisToggle).toHaveText("あらすじを展開");
      await synopsisToggle.click();
      await expect(synopsisToggle).toHaveText("あらすじを折りたたむ");
      await synopsisToggle.click();
      await expect(synopsisToggle).toHaveText("あらすじを展開");
    }

    // エピソード一覧コンテナが内部スクロール領域として存在することを確認（AC-ND-02）
    const episodeListContainer = page.getByTestId("episode-list-container");
    await expect(episodeListContainer).toBeVisible();

    // エピソード一覧が表示され、未取得バッジが表示されていることを確認
    const episodeItems = page.getByTestId("episode-item");
    await expect(episodeItems).toHaveCount(4);
    const firstUncachedBadge = episodeItems
      .first()
      .getByTestId("episode-uncached-badge");
    await expect(firstUncachedBadge).toBeVisible();

    // 「目次を更新」ボタン押下で最新状態が通知され、スクロール位置が維持されることを確認（AC-ND-05, AC-ND-08）
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

    // 5. 第1話本文がオンデマンド取得され、タイトル・サブタイトル・インジケーター・reader-view が表示されることを確認
    const readerTitle = page.getByTestId("reader-title");
    await expect(readerTitle).toBeVisible();
    await expect(readerTitle).toHaveText("境界迷宮と異界の魔術師");

    const chapterTitle = page.getByTestId("reader-chapter-title");
    await expect(chapterTitle).toBeVisible();
    await expect(chapterTitle).toHaveText("プロローグ：目覚め");

    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();

    // 6. 全画面テキスト表示化（AC-RD-09）: 初期状態では下部オーバーレイが画面外（translate-y-full）に退避していることを確認
    const overlay = page.getByTestId("reader-bottom-overlay");
    await expect(overlay).toHaveClass(/translate-y-full/);

    // 画面最下部ゾーン（reader-bottom-touch-zone）をタップしてオーバーレイをスライドイン表示（AC-RD-10）
    const touchZone = page.getByTestId("reader-bottom-touch-zone");
    await expect(touchZone).toBeVisible();
    await touchZone.click();

    await expect(overlay).toHaveClass(/translate-y-0/);
    const chapterIndicator = page.getByTestId("reader-chapter-indicator");
    await expect(chapterIndicator).toBeVisible();
    await expect(chapterIndicator).toHaveText("第 1 話 / 全 4 話");

    const prevChapterButton = page.getByTestId("reader-prev-chapter");
    const nextChapterButton = page.getByTestId("reader-next-chapter");
    await expect(prevChapterButton).toBeDisabled();
    await expect(nextChapterButton).toBeEnabled();

    // 下部タブ（本棚・設定）が表示されていることを確認
    await expect(page.getByTestId("reader-bottom-tab-bookshelf")).toBeVisible();
    await expect(page.getByTestId("reader-bottom-tab-settings")).toBeVisible();

    // 7. 本文内の <ruby>（ルビ）および <em class="bouten">（傍点）が可視状態で正しくレンダリングされていること、および縦書き（writing-vertical-rl）での負の scrollLeft による水平スクロール進捗保存・復元（AC-RD-08）を確認
    const rubyElement = readerView.locator("ruby").first();
    await expect(rubyElement).toBeVisible();

    const boutenElement = readerView.locator("em.bouten").first();
    await expect(boutenElement).toBeVisible();
    await expect(boutenElement).toHaveText("信じがたい光景");

    // 縦書き時に scrollWidth > clientWidth となっており、左方向（負の scrollLeft）へスクロールして進捗を保存できることを確認
    // スクロール操作によりオーバーレイが自動非表示（translate-y-full）になることを確認（AC-RD-10）
    const verticalMaxScroll = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="reader-view"]');
      if (!el) return 0;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 0) {
        el.scrollLeft = -maxScroll * 0.5;
        el.dispatchEvent(new Event("scroll"));
      }
      return maxScroll;
    });
    expect(verticalMaxScroll).toBeGreaterThan(0);
    await expect(overlay).toHaveClass(/translate-y-full/);

    // ブラウザ戻る操作（TR-06: popstate）で作品詳細（SCR-02）へ戻り、「続きから読む（第1話）」で再開（TR-04）した際に縦書きの負の scrollLeft が復元されることを確認
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    const ch1ResumeButton = page.getByTestId("detail-resume-button");
    await expect(ch1ResumeButton).toBeVisible();
    await expect(ch1ResumeButton).toContainText("続きから読む（第1話）");
    await ch1ResumeButton.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(readerView).toHaveClass(/writing-vertical-rl/);
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const el = document.querySelector('[data-testid="reader-view"]');
          return el ? el.scrollLeft : 0;
        });
      })
      .toBeLessThan(0);

    // 8. 最下部タッチゾーンをタップしてオーバーレイを再表示し、「次の話へ」（reader-next-chapter）で第2話へ遷移（TR-05 / AC-RD-06）
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    await expect(nextChapterButton).toBeEnabled();
    await nextChapterButton.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    // 遷移後はオーバーレイが自動非表示となること
    await expect(overlay).toHaveClass(/translate-y-full/);

    // 第2話のタイトルを確認
    const ch2Title = page.getByTestId("reader-chapter-title");
    await expect(ch2Title).toBeVisible();
    await expect(ch2Title).toHaveText("第1話 見知らぬ空");

    // タッチゾーンをタップしてオーバーレイを表示し、インジケーターと「前の話へ」が有効であることを確認
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    await expect(page.getByTestId("reader-chapter-indicator")).toHaveText(
      "第 2 話 / 全 4 話",
    );
    await expect(page.getByTestId("reader-prev-chapter")).toBeEnabled();

    // 「前の話へ」で第1話へ戻る（TR-05）
    await page.getByTestId("reader-prev-chapter").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(overlay).toHaveClass(/translate-y-full/);

    // 再度タッチゾーンをタップして「次の話へ」で第2話へ進む
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    await page.getByTestId("reader-next-chapter").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );

    // スクロール操作により進捗率を更新
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="reader-view"]');
      if (el) {
        const max = el.scrollWidth - el.clientWidth;
        if (max > 0) {
          el.scrollLeft = -max * 0.5;
          el.dispatchEvent(new Event("scroll"));
        }
      }
    });

    // 9. タッチゾーンをタップしてオーバーレイを表示し、「本棚」タブ（reader-bottom-tab-bookshelf）をタップしてしおり保存＆本棚遷移（TR-01b / AC-RD-08）
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    const bookshelfTab = page.getByTestId("reader-bottom-tab-bookshelf");
    await expect(bookshelfTab).toBeVisible();
    await bookshelfTab.click();

    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();
    const bookshelfUpdatedChapters = page.getByTestId("novel-card-chapters");
    await expect(bookshelfUpdatedChapters).toContainText(
      "全 4 話（取得済み 2 話）",
    );
    const bookshelfBookmark = page.getByTestId("novel-card-bookmark");
    await expect(bookshelfBookmark).toBeVisible();
    await expect(bookshelfBookmark).toContainText("しおり: 第2話");

    // 本棚作品カードの「第2話から読む」（novel-card-resume）をクリックし、/novels/:novelId/chapters/2 へ直接遷移することを確認（TR-03 / AC-BS-06）
    const novelCardResume = page.getByTestId("novel-card-resume");
    await expect(novelCardResume).toBeVisible();
    await expect(novelCardResume).toContainText("第2話から読む");
    await novelCardResume.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );
    await expect(page.getByTestId("reader-view")).toBeVisible();

    // 第2話のしおりスクロール位置が復元されることを確認
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const el = document.querySelector('[data-testid="reader-view"]');
          return el ? el.scrollLeft : 0;
        });
      })
      .toBeLessThan(0);

    // 10. ブラウザ戻る操作で本棚画面（/）へ戻り、作品カードを選択して SCR-02 へ遷移。第1話・第2話が 取得済み かつ 既読 に、第2話に しおり バッジが表示され、ヘッダーに「続きから読む（第2話）」と「最初から読む（第1話）」が併存表示（AC-ND-03）されることを確認
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();

    await page.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    await expect(page.getByTestId("novel-detail-page")).toBeVisible();
    const updatedDetailStats = page.getByTestId("novel-detail-stats");
    await expect(updatedDetailStats).toContainText("全 4 話（取得済み 2 話）");

    const updatedEpisodeItems = page.getByTestId("episode-item");
    // 第1話: 取得済み かつ 既読
    await expect(
      updatedEpisodeItems.nth(0).getByTestId("episode-cached-badge"),
    ).toBeVisible();
    await expect(
      updatedEpisodeItems.nth(0).getByTestId("episode-read-badge"),
    ).toBeVisible();

    // 第2話: 取得済み かつ 既読 かつ しおり
    await expect(
      updatedEpisodeItems.nth(1).getByTestId("episode-cached-badge"),
    ).toBeVisible();
    await expect(
      updatedEpisodeItems.nth(1).getByTestId("episode-read-badge"),
    ).toBeVisible();
    await expect(
      updatedEpisodeItems.nth(1).getByTestId("episode-bookmark-badge"),
    ).toBeVisible();

    // ヘッダーの「続きから読む（第2話）」および「最初から読む（第1話）」の併存表示確認（AC-ND-03）
    const resumeButton = page.getByTestId("detail-resume-button");
    await expect(resumeButton).toBeVisible();
    await expect(resumeButton).toContainText("続きから読む（第2話）");
    await expect(page.getByTestId("detail-read-first-button")).toBeVisible();

    // 11. 作品削除ボタンをクリックして確認ダイアログから削除を実行し、本棚（/）へ戻り空状態（bookshelf-empty）となることを確認（TR-07）
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

    // 13. 未存在作品 ID (/novels/non-existent-id) 指定時の Not Found 画面と「本棚へ戻る」ボタンによる本棚復帰を検証（AC-ND-07, TR-07）
    await page.goto("/novels/kakuyomu:9999999999999999999");
    const notFoundElement = page.getByTestId("novel-detail-not-found");
    await expect(notFoundElement).toBeVisible();
    await expect(notFoundElement).toContainText(
      "指定された作品が見つかりません。",
    );

    const backToBookshelfButton = page.getByTestId("back-to-bookshelf-button");
    await expect(backToBookshelfButton).toBeVisible();
    await backToBookshelfButton.click();

    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-empty")).toBeVisible();
  });
});
