import { test, expect } from "@playwright/test";

test.describe("SCN-01: 小説リーダー縦貫通・組版設定・前後話遷移・既読しおり復元シナリオ", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("全画面シェル・設定画面組版変更・作品登録からSCR-02目次確認・リーダー本文設定即時反映・前後話遷移・OSバックキー論理階層遷移・既読しおり復元・作品削除までの一連の動作が正常に機能する", async ({
    page,
  }) => {
    // 1. 初期表示（/）で全画面シェル（100dvh・ウィンドウ全体のスクロールバーなし）および本棚の空状態（bookshelf-empty）を確認
    const appRoot = page.getByTestId("app-root");
    await expect(appRoot).toBeVisible();
    await expect(appRoot).toHaveClass(/h-dvh/);

    const hasWindowScroll = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight;
    });
    expect(hasWindowScroll).toBe(false);

    // 下部タブバー（BottomTabBar）が表示され、「本棚」がアクティブであることを確認
    const bottomTabBar = page.getByTestId("bottom-tab-bar");
    await expect(bottomTabBar).toBeVisible();

    const tabBookshelf = page.getByTestId("tab-bookshelf");
    const tabSettings = page.getByTestId("tab-settings");
    await expect(tabBookshelf).toBeVisible();
    await expect(tabSettings).toBeVisible();
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");
    await expect(tabSettings).toHaveAttribute("aria-selected", "false");

    const emptyState = page.getByTestId("bookshelf-empty");
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText("本棚に作品が登録されていません");

    // 2. 下部タブ「設定」をタップして /settings（SCR-05）へ遷移し、設定変更およびプレビュー枠即時反映を確認（TR-12）
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");
    await expect(tabSettings).toHaveAttribute("aria-selected", "true");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "false");

    const settingsPage = page.getByTestId("settings-page");
    await expect(settingsPage).toBeVisible();

    // サンプル文章プレビュー枠の確認（ルビ・傍点の描画確認）
    const samplePreview = page.getByTestId("sample-text-preview");
    await expect(samplePreview).toBeVisible();
    await expect(samplePreview.locator("ruby").first()).toBeVisible();
    await expect(samplePreview.locator("em.bouten").first()).toBeVisible();

    // 初期設定値の確認（縦書き・ライト・18px・1.8）
    await expect(samplePreview).toHaveAttribute(
      "data-writing-mode",
      "vertical-rl",
    );
    await expect(samplePreview).toHaveAttribute("data-theme", "light");
    await expect(samplePreview).toHaveAttribute("data-font-size", "18");
    await expect(samplePreview).toHaveAttribute("data-line-height", "1.8");

    // 組版設定の変更:
    // (a) 組み方向を横書きへ切替し、プレビュー確認後に再度縦書きへ戻す（R1-01 / 縦書き負の scrollLeft 回帰保証のため）
    const toggleOrientation = page.getByTestId("toggle-orientation");
    await toggleOrientation.click();
    await expect(samplePreview).toHaveAttribute(
      "data-writing-mode",
      "horizontal-tb",
    );
    await toggleOrientation.click();
    await expect(samplePreview).toHaveAttribute(
      "data-writing-mode",
      "vertical-rl",
    );

    // (b) カラーテーマをセピアに変更
    const themeSepia = page.getByTestId("theme-sepia");
    await themeSepia.click();
    await expect(samplePreview).toHaveAttribute("data-theme", "sepia");

    // (c) 文字サイズを 20px へ拡大
    const fontSizeIncrease = page.getByTestId("font-size-increase");
    await fontSizeIncrease.click();
    await expect(page.getByTestId("font-size-value")).toHaveText("20px");
    await expect(samplePreview).toHaveAttribute("data-font-size", "20");

    // (d) 行間倍率を 2.0 へ拡大
    const lineHeightIncrease = page.getByTestId("line-height-increase");
    await lineHeightIncrease.click();
    await expect(page.getByTestId("line-height-value")).toHaveText("2.0");
    await expect(samplePreview).toHaveAttribute("data-line-height", "2");

    // 選択中の「設定」タブを再タップしても重複履歴が追加されず、戻り先が破壊されないことを確認（R1-21）
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");

    // ブラウザ戻る操作（TR-12）で本棚画面（/）へ復帰することを確認
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");
    await expect(tabSettings).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("bookshelf-empty")).toBeVisible();

    // 3. 「URLから作品を追加」ダイアログを開き、URLを入力（サンプルURL自動入力）して登録を実行
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
    await expect(bottomTabBar).toBeVisible();
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    // 4. 作品カード本体（novel-card-select）をクリックして /novels/:novelId（SCR-02 作品詳細・目次画面）へ遷移（TR-02）
    const novelCardSelect = page.getByTestId("novel-card-select");
    await expect(novelCardSelect).toBeVisible();
    await novelCardSelect.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    const novelDetailPage = page.getByTestId("novel-detail-page");
    await expect(novelDetailPage).toBeVisible();
    // 目次画面でも下部タブバーが表示され、「本棚」がアクティブであること
    await expect(bottomTabBar).toBeVisible();
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

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

    // エピソード一覧コンテナをスクロールさせ、scrollTop を設定（R1-02 / AC-ND-08）
    await episodeListContainer.evaluate((el) => {
      el.scrollTop = 50;
      el.dispatchEvent(new Event("scroll"));
    });
    const scrolledTop = await episodeListContainer.evaluate(
      (el) => el.scrollTop,
    );
    expect(scrolledTop).toBeGreaterThanOrEqual(0);

    // 「目次を更新」ボタン押下で最新状態が通知され、スクロール位置が維持されることを確認（AC-ND-05, AC-ND-08）
    const refreshButton = page.getByTestId("refresh-toc-button");
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    const refreshNotice = page.getByTestId("novel-detail-notice");
    await expect(refreshNotice).toBeVisible();
    await expect(refreshNotice).toHaveText("最新の状態です");

    // 目次更新後もスクロール位置（scrollTop）が維持されていることのアサーション（R1-02 / AC-ND-08）
    const maintainedTop = await episodeListContainer.evaluate(
      (el) => el.scrollTop,
    );
    expect(maintainedTop).toBe(scrolledTop);

    // 5. 目次一覧から第1話エピソード行を選択して /novels/:novelId/chapters/1（SCR-03）へ遷移（TR-04）
    await episodeItems.first().click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );

    // リーダー画面では下部タブバー（BottomTabBar）が非表示となること
    await expect(bottomTabBar).not.toBeVisible();

    // 第1話本文がオンデマンド取得され、タイトル・サブタイトル・インジケーター・reader-view が表示されることを確認
    const readerTitle = page.getByTestId("reader-title");
    await expect(readerTitle).toBeVisible();
    await expect(readerTitle).toHaveText("境界迷宮と異界の魔術師");

    const chapterTitle = page.getByTestId("reader-chapter-title");
    await expect(chapterTitle).toBeVisible();
    await expect(chapterTitle).toHaveText("プロローグ：目覚め");

    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();

    // 設定画面（/settings）で変更した組版設定（縦書き・セピア・20px・2.0）がリーダー本文へ適用されていることの確認
    await expect(readerView).toHaveAttribute(
      "data-writing-mode",
      "vertical-rl",
    );
    await expect(readerView).toHaveAttribute("data-theme", "sepia");
    await expect(readerView).toHaveAttribute("data-font-size", "20");
    await expect(readerView).toHaveAttribute("data-line-height", "2");

    // 6. 全画面テキスト表示化（AC-RD-09）: 初期状態では下部オーバーレイが画面外（translate-y-full）に退避していることを確認
    const overlay = page.getByTestId("reader-bottom-overlay");
    await expect(overlay).toHaveClass(/translate-y-full/);

    const touchZone = page.getByTestId("reader-bottom-touch-zone");
    await expect(touchZone).toBeVisible();

    // 最下部ゾーンでのスワイプ・ドラッグ操作（移動距離 >= 10px）ではオーバーレイが開かないこと（HO-12: スワイプ誤検知防止）
    const touchBox = await touchZone.boundingBox();
    if (touchBox) {
      const startX = touchBox.x + touchBox.width / 2;
      const startY = touchBox.y + touchBox.height / 2;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX, startY - 30, { steps: 5 });
      await page.mouse.up();
      await expect(overlay).toHaveClass(/translate-y-full/);
    }

    // 画面最下部ゾーン（reader-bottom-touch-zone）をタップしてオーバーレイをスライドイン表示（AC-RD-10）
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);

    // 外側タップ: オーバーレイ外の本文エリア（reader-view）をタップしてオーバーレイが自動非表示（translate-y-full）になることを確認（AC-RD-10）
    await readerView.click({ position: { x: 100, y: 100 } });
    await expect(overlay).toHaveClass(/translate-y-full/);

    // 再度最下部ゾーンをタップしてオーバーレイを再表示
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);

    // 閉じるボタン（reader-bottom-overlay-close）でオーバーレイが閉じることを確認
    const overlayCloseButton = page.getByTestId("reader-bottom-overlay-close");
    await expect(overlayCloseButton).toBeVisible();
    await overlayCloseButton.click();
    await expect(overlay).toHaveClass(/translate-y-full/);

    // 再度最下部ゾーンをタップしてオーバーレイを表示
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    const chapterIndicator = page.getByTestId("reader-chapter-indicator");
    await expect(chapterIndicator).toBeVisible();
    await expect(chapterIndicator).toHaveText("第 1 話 / 全 4 話");

    const prevChapterButton = page.getByTestId("reader-prev-chapter");
    const nextChapterButton = page.getByTestId("reader-next-chapter");
    await expect(prevChapterButton).toBeDisabled();
    await expect(nextChapterButton).toBeEnabled();

    // リーダー下部オーバーレイ内のタブ（本棚・設定）が表示されていることを確認
    await expect(page.getByTestId("reader-bottom-tab-bookshelf")).toBeVisible();
    await expect(page.getByTestId("reader-bottom-tab-settings")).toBeVisible();

    // 7. 本文内の <ruby>（ルビ）および <em class="bouten">（傍点）が可視状態で正しくレンダリングされていることを確認
    const rubyElement = readerView.locator("ruby").first();
    await expect(rubyElement).toBeVisible();

    const boutenElement = readerView.locator("em.bouten").first();
    await expect(boutenElement).toBeVisible();
    await expect(boutenElement).toHaveText("信じがたい光景");

    // 縦書き時に scrollWidth > clientWidth となっており、左方向（負の scrollLeft）へスクロールして進捗を保存できることを確認（AC-RD-08, R1-01）
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

    // 縦書きモードにおいて負の scrollLeft（scrollLeft < 0）が設定されていることを確認（R1-01）
    const currentScrollLeft = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="reader-view"]');
      return el ? el.scrollLeft : 0;
    });
    expect(currentScrollLeft).toBeLessThan(0);

    // ブラウザ戻る操作（TR-06: popstate）で作品詳細（SCR-02）へ戻り、「続きから読む（第1話）」で再開（TR-04）した際に縦書きスクロール位置が復元されることを確認
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
    await expect(readerView).toHaveAttribute(
      "data-writing-mode",
      "vertical-rl",
    );
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const el = document.querySelector('[data-testid="reader-view"]');
          return el ? el.scrollLeft : 0;
        });
      })
      .toBeLessThan(0);

    // リーダー画面下部オーバーレイから設定画面（SCR-05）への遷移導線（TR-12）および戻り先保証（R1-03, R1-21）
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    const readerSettingsTab = page.getByTestId("reader-bottom-tab-settings");
    await expect(readerSettingsTab).toBeVisible();
    await readerSettingsTab.click();

    // 設定画面（/settings）へ遷移すること（TR-12）
    await expect(page).toHaveURL("/settings");
    await expect(settingsPage).toBeVisible();
    await expect(tabSettings).toHaveAttribute("aria-selected", "true");

    // 設定画面で選択中の「設定」タブを再タップしても重複履歴が追加されないことを確認（R1-21）
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");

    // ブラウザ戻る操作（TR-12）1回でリーダー画面（SCR-03）へ正しく復帰することを確認（R1-03, R1-21）
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(readerView).toBeVisible();

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

    // スクロール操作により進捗率を更新（縦書き時の負の scrollLeft または横書き時の scrollTop）
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="reader-view"]');
      if (el) {
        const verticalMax = el.scrollWidth - el.clientWidth;
        if (verticalMax > 0) {
          el.scrollLeft = -verticalMax * 0.5;
          el.dispatchEvent(new Event("scroll"));
        }
        const horizontalMax = el.scrollHeight - el.clientHeight;
        if (horizontalMax > 0) {
          el.scrollTop = horizontalMax * 0.5;
          el.dispatchEvent(new Event("scroll"));
        }
      }
    });

    // 9. OS バックキー（page.goBack()）論理階層遷移制御（TR-06 / TR-07）の検証
    // 第2話からブラウザ戻るを 1 回実行した際、第1話ではなく作品詳細・目次画面（SCR-02）へ復帰すること
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();
    await expect(bottomTabBar).toBeVisible();

    // 目次画面への復帰時に第2話のしおり・進捗率が正しく保存・表示されていることの確認
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

    // しおり話数（第2話）への初期スクロール調整（AC-ND-08 / R1-02）により、第2話要素が可視領域内にあることを確認
    await expect(updatedEpisodeItems.nth(1)).toBeInViewport();

    // ヘッダーの「続きから読む（第2話）」および「最初から読む（第1話）」の併存表示確認（AC-ND-03）
    const resumeButton = page.getByTestId("detail-resume-button");
    await expect(resumeButton).toBeVisible();
    await expect(resumeButton).toContainText("続きから読む（第2話）");
    await expect(page.getByTestId("detail-read-first-button")).toBeVisible();

    // 目次画面でブラウザ戻る（page.goBack()）を実行した際、本棚画面（SCR-01）へ復帰すること
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    const bookshelfUpdatedChapters = page.getByTestId("novel-card-chapters");
    await expect(bookshelfUpdatedChapters).toContainText(
      "全 4 話（取得済み 2 話）",
    );
    const bookshelfBookmark = page.getByTestId("novel-card-bookmark");
    await expect(bookshelfBookmark).toBeVisible();
    await expect(bookshelfBookmark).toContainText("しおり: 第2話");

    // 10. 本棚作品カードの「第2話から読む」（novel-card-resume）をクリックし、/novels/:novelId/chapters/2 へ直接遷移することを確認（TR-03 / AC-BS-06）
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

    // 第2話の縦書きしおりスクロール位置が復元されることを確認（AC-RD-08 / R1-01）
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          const el = document.querySelector('[data-testid="reader-view"]');
          return el ? el.scrollLeft : 0;
        });
      })
      .toBeLessThan(0);

    // 本棚から直行した場合でも、ブラウザ戻る（page.goBack()）で目次画面（SCR-02）へ遷移すること（整流化履歴の検証）
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();

    // 11. どこからでも下部タブ「本棚」をタップした際、本棚トップ（/）へ直行することの確認
    // 目次画面で「設定」タブをタップ
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");
    await expect(tabSettings).toHaveAttribute("aria-selected", "true");

    // 設定画面から「本棚」タブをタップして本棚トップへ直行
    await tabBookshelf.click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    // 12. 作品削除ボタンをクリックして確認ダイアログから削除を実行し、本棚（/）へ戻り空状態（bookshelf-empty）となることを確認（TR-07）
    await page.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

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

    // 14. 未存在作品・エピソードのリーダー画面 (/novels/non-existent/chapters/1) において、空状態（reader-empty）および下部オーバーレイ初期表示（translate-y-0）と「本棚」タブによる復帰を検証（AC-RD-10）
    await page.goto("/novels/kakuyomu:9999999999999999999/chapters/1");
    const readerEmpty = page.getByTestId("reader-empty");
    await expect(readerEmpty).toBeVisible();
    const errorOverlay = page.getByTestId("reader-bottom-overlay");
    await expect(errorOverlay).toHaveClass(/translate-y-0/);

    const errorBookshelfTab = page.getByTestId("reader-bottom-tab-bookshelf");
    await expect(errorBookshelfTab).toBeVisible();
    await errorBookshelfTab.click();

    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-empty")).toBeVisible();
  });
});
