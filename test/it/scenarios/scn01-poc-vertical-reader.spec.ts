import { test, expect } from "@playwright/test";

test.describe("SCN-01: 小説リーダー縦貫通・組版設定・前後話遷移・既読しおり復元シナリオ", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady === true,
    );
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

    // フッターバージョン表示の確認（AC-ST-20, v1.0 Issue #304）
    const versionFooter = page.getByTestId("settings-version-footer");
    await expect(versionFooter).toBeVisible();
    await expect(versionFooter).toHaveText("Yommy v1.0.0");

    // サンプル文章プレビュー枠の確認（ルビ・傍点の描画確認）
    const samplePreview = page.getByTestId("sample-text-preview");
    await expect(samplePreview).toBeVisible();
    await expect(samplePreview.locator("ruby").first()).toBeVisible();
    await expect(samplePreview.locator("em.bouten").first()).toBeVisible();

    // 初期設定値の確認（縦書き・ライト・18px・1.8・UD明朝・余白20px）
    await expect(samplePreview).toHaveAttribute(
      "data-writing-mode",
      "vertical-rl",
    );
    await expect(samplePreview).toHaveAttribute("data-theme", "light");
    await expect(samplePreview).toHaveAttribute("data-font-size", "18");
    await expect(samplePreview).toHaveAttribute("data-line-height", "1.8");
    await expect(samplePreview).toHaveAttribute(
      "data-font-family",
      "biz-ud-mincho",
    );
    await expect(samplePreview).toHaveAttribute("data-page-margin", "20");

    const fontFamilySelect = page.getByTestId("font-family-select");
    await expect(fontFamilySelect).toBeVisible();
    await expect(fontFamilySelect).toHaveValue("biz-ud-mincho");

    const pageMarginValue = page.getByTestId("page-margin-value");
    await expect(pageMarginValue).toBeVisible();
    await expect(pageMarginValue).toHaveText("20px");

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

    // (e) フォント種別を「教科書体（Klee）」に変更
    await fontFamilySelect.selectOption("klee");
    await expect(samplePreview).toHaveAttribute("data-font-family", "klee");
    const kleePreviewStyle = await samplePreview.getAttribute("style");
    expect(kleePreviewStyle).toContain("Klee");

    // (f) 画面余白を 28px へ拡大（+4px を 2回クリック）
    const pageMarginIncrease = page.getByTestId("page-margin-increase");
    await pageMarginIncrease.click(); // 24px
    await pageMarginIncrease.click(); // 28px
    await expect(pageMarginValue).toHaveText("28px");
    await expect(samplePreview).toHaveAttribute("data-page-margin", "28");
    const marginPreviewStyle = await samplePreview.getAttribute("style");
    expect(marginPreviewStyle).toContain("padding: 28px");

    // 選択中の「設定」タブを再タップしても重複履歴が追加されず、戻り先が破壊されないことを確認（R1-21）
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");

    // ブラウザ戻る操作（TR-12）で本棚画面（/）へ復帰することを確認
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");
    await expect(tabSettings).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("bookshelf-empty")).toBeVisible();

    // 3. 共通サービス（window.__yommyServices）を用いてサンプル作品をシード登録し、本棚をリロードして作品カード表示を確認
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const sampleUrl = "https://kakuyomu.jp/works/16817330658027210412";
      const response = await services.httpClient.getHtml({ url: sampleUrl });
      const parser = services.parserRegistry.requireParser(sampleUrl);
      const parsedIndex = parser.parseNovelIndex(response.html, sampleUrl);
      await services.novelRepository.upsertNovelWithToc(
        parsedIndex,
        new Date().toISOString(),
      );
    });
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady === true,
    );

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
    await expect(detailStats).toContainText("全 4 話（取得済み 0 話");

    // 章見出しが存在することを確認
    const sectionHeader = page.getByTestId("chapter-section-header").first();
    await expect(sectionHeader).toBeVisible();

    // あらすじの折りたたみトグル動作を確認（AC-ND-01, R1-21: 決定論的検証）
    const synopsisToggle = page.getByTestId("synopsis-toggle-button");
    await expect(synopsisToggle).toBeVisible();
    await expect(synopsisToggle).toHaveText("あらすじを展開");
    await synopsisToggle.click();
    await expect(synopsisToggle).toHaveText("あらすじを折りたたむ");
    await synopsisToggle.click();
    await expect(synopsisToggle).toHaveText("あらすじを展開");

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

    // 設定画面（/settings）で変更した組版設定（縦書き・セピア・20px・2.0・教科書体klee・余白28px）がリーダー本文へ適用されていることの確認
    await expect(readerView).toHaveAttribute(
      "data-writing-mode",
      "vertical-rl",
    );
    await expect(readerView).toHaveAttribute("data-theme", "sepia");
    await expect(readerView).toHaveAttribute("data-font-size", "20");
    await expect(readerView).toHaveAttribute("data-line-height", "2");
    await expect(readerView).toHaveAttribute("data-font-family", "klee");
    await expect(readerView).toHaveAttribute("data-page-margin", "28");

    const readerStyle = await readerView.getAttribute("style");
    expect(readerStyle).toContain("Klee");

    const readerContent = page.getByTestId("reader-content");
    await expect(readerContent).toBeVisible();
    // 縦書きページめくり組版時のマルチカラム column-gap は pageMarginPx * 2 = 56px
    const readerContentStyle = await readerContent.getAttribute("style");
    expect(readerContentStyle).toContain("column-gap: 56px");
    expect(readerContentStyle).toContain("columns: 1");
    expect(readerContentStyle).toContain("transform: translateY(0px)");

    // デフォルト縦書き時のページめくりモード初期有効化・行途切れなし（overflow-hidden）・ページインジケーター（1 / N）の検証（AC-RD-15, AC-RD-16）
    await expect(readerView).toHaveAttribute("data-paging-mode", "auto");
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "paged",
    );
    await expect(readerView).toHaveAttribute("data-current-page", "1");
    await expect(readerView).toHaveClass(/overflow-hidden/);
    await expect(page.getByTestId("reader-page").locator("main")).toHaveClass(
      /touch-none/,
    );

    await expect(readerView).toHaveAttribute(
      "data-total-pages",
      /^[2-9]\d*|^\d{2,}$/,
    );
    const totalPagesStr = (await readerView.getAttribute("data-total-pages"))!;
    expect(Number(totalPagesStr)).toBeGreaterThanOrEqual(2);

    const pageIndicator = page.getByTestId("reader-page-indicator");
    await expect(pageIndicator).toBeVisible();
    await expect(pageIndicator).toHaveText(`1 / ${totalPagesStr}`);

    // 6. 全画面テキスト表示化（AC-RD-09）: 初期状態では上下オーバーレイが画面外（-translate-y-full / translate-y-full）に退避していることを確認
    const topOverlay = page.getByTestId("reader-top-overlay");
    await expect(topOverlay).toHaveClass(/-translate-y-full/);
    const overlay = page.getByTestId("reader-bottom-overlay");
    await expect(overlay).toHaveClass(/translate-y-full/);

    const readerBox = await readerView.boundingBox();
    expect(readerBox).not.toBeNull();

    // Kindle様式: 画面中央領域タップ（幅20%〜80%領域）で上下連動オーバーレイが開閉すること（AC-RD-17, AC-RD-22）
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.5,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(topOverlay).toHaveClass(/translate-y-0/);
    await expect(overlay).toHaveClass(/translate-y-0/);

    // 上部オーバーレイの作品名・サブタイトル・目次ボタン表示検証（AC-RD-22〜24）
    await expect(page.getByTestId("reader-top-novel-title")).toHaveText(
      "境界迷宮と異界の魔術師",
    );
    await expect(page.getByTestId("reader-top-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );
    const backToTocBtn = page.getByTestId("reader-top-back-to-toc");
    await expect(backToTocBtn).toBeVisible();

    // 上部オーバーレイ「← 目次」ボタン押下による目次復帰（TR-06, AC-RD-24）とブラウザ戻り復帰の検証
    await backToTocBtn.click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(readerView).toBeVisible();

    // リーダー復帰後、再度中央タップで上下オーバーレイを展開
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.5,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(topOverlay).toHaveClass(/translate-y-0/);
    await expect(overlay).toHaveClass(/translate-y-0/);

    // 縦書きページめくり時の RTL ページシークバーの検証（AC-RD-25）
    const seekbarSection = page.getByTestId("reader-page-seekbar-section");
    await expect(seekbarSection).toBeVisible();
    const seekbar = page.getByTestId("reader-page-seekbar");
    await expect(seekbar).toBeVisible();
    await expect(seekbar).toHaveAttribute("dir", "rtl");
    await expect(seekbar).toHaveAttribute("min", "1");
    await expect(seekbar).toHaveAttribute("max", totalPagesStr);
    await expect(seekbar).toHaveAttribute("value", "1");
    const seekbarLabel = page.getByTestId("reader-page-seekbar-label");
    await expect(seekbarLabel).toHaveText(`1 / ${totalPagesStr} ページ`);

    // シークバー操作によるページ移動とオーバーレイ展開維持の検証（AC-RD-25）
    await seekbar.fill("2");
    await seekbar.dispatchEvent("change");
    await expect(readerView).toHaveAttribute("data-current-page", "2");
    await expect(pageIndicator).toHaveText(`2 / ${totalPagesStr}`);
    await expect(seekbarLabel).toHaveText(`2 / ${totalPagesStr} ページ`);
    await expect(topOverlay).toHaveClass(/translate-y-0/);
    await expect(overlay).toHaveClass(/translate-y-0/);

    // シークバーを1ページ目に戻す
    await seekbar.fill("1");
    await seekbar.dispatchEvent("change");
    await expect(readerView).toHaveAttribute("data-current-page", "1");
    await expect(pageIndicator).toHaveText(`1 / ${totalPagesStr}`);
    await expect(seekbarLabel).toHaveText(`1 / ${totalPagesStr} ページ`);
    await expect(topOverlay).toHaveClass(/translate-y-0/);
    await expect(overlay).toHaveClass(/translate-y-0/);

    // 第1話では「前の話へ」ボタンが無効（disabled）化されていることを確認（R1-18, AC-RD-06）
    const prevChapterButton = page.getByTestId("reader-prev-chapter");
    await expect(prevChapterButton).toBeDisabled();

    // 再度中央領域タップで上下オーバーレイが同時に閉じること（AC-RD-22）
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.5,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(topOverlay).toHaveClass(/-translate-y-full/);
    await expect(overlay).toHaveClass(/translate-y-full/);

    // Kindle様式: 画面左端タップ（幅約20% / 縦書き次ページ）による水平スライドアニメーション・ページめくり・インジケーター更新（AC-RD-17, AC-RD-17a）
    const swipeTrack = page.getByTestId("reader-swipe-track");
    await expect(swipeTrack).toBeVisible();

    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.1,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(readerView).toHaveAttribute("data-current-page", "2");
    await expect(pageIndicator).toHaveText(`2 / ${totalPagesStr}`);
    // アニメーション完了時はトランジションなし（none）で中央スロットにリセットされること（AC-RD-17a）
    await expect(swipeTrack).toHaveCSS("transition-property", "none");

    // Kindle様式: 画面右端タップ（幅約20% / 縦書き前ページ）による水平スライドアニメーション・ページめくり・インジケーター更新（AC-RD-17, AC-RD-17a）
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.9,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(readerView).toHaveAttribute("data-current-page", "1");
    await expect(pageIndicator).toHaveText(`1 / ${totalPagesStr}`);
    await expect(swipeTrack).toHaveCSS("transition-property", "none");

    // Kindle様式: ドラッグ追従・30%未満スナップバック・30%以上ドラッグ確定遷移の検証（AC-RD-17b, R1-21）
    const initialSwipeLeft = await swipeTrack.evaluate(
      (el) => (el as HTMLElement).style.left,
    );

    if (readerBox) {
      // 1. 30%未満（30px）かつ低速（velocity < 0.5 px/ms）のドラッグ＆リリースでスナップバックしページ1に留まること
      const startX = readerBox.x + 100;
      const smallDragX = startX + 30;
      const dragY = readerBox.y + readerBox.height * 0.4;
      await page.mouse.move(startX, dragY);
      await page.mouse.down();
      await page.mouse.move(smallDragX, dragY, { steps: 5 });
      const draggingSwipeLeft = await swipeTrack.evaluate(
        (el) => (el as HTMLElement).style.left,
      );
      expect(draggingSwipeLeft).not.toBe(initialSwipeLeft);
      await page.mouse.up();
    }
    await expect(swipeTrack).toHaveCSS("transition-property", "none");
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    await page.evaluate(() => window.getSelection()?.removeAllRanges());

    if (readerBox) {
      // 2. 30%以上（約40%）の右方向ドラッグ＆リリースで次ページ（第2ページ）へ確定遷移すること（AC-RD-17b）
      const startX = readerBox.x + 100;
      const largeDragX = startX + readerBox.width * 0.4;
      const dragY = readerBox.y + readerBox.height * 0.4;
      await page.mouse.move(startX, dragY);
      await page.mouse.down();
      await page.mouse.move(largeDragX, dragY, { steps: 10 });
      await page.mouse.up();
    }
    await expect(readerView).toHaveAttribute("data-current-page", "2");
    await expect(pageIndicator).toHaveText(`2 / ${totalPagesStr}`);
    await expect(swipeTrack).toHaveCSS("transition-property", "none");

    // 右端タップで第1ページへ戻す
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.9,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(readerView).toHaveAttribute("data-current-page", "1");
    await expect(swipeTrack).toHaveCSS("transition-property", "none");

    // Kindle様式: 高速連打（200msアニメーション完了前の連続左端タップ）で進行中ページが即時確定され次操作が取りこぼされないこと（AC-RD-17c, R1-21）
    const boundaryHint = page.getByTestId("reader-episode-boundary-hint");
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.1,
        readerBox.y + readerBox.height * 0.4,
      );
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.1,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(readerView).toHaveAttribute("data-current-page", "2");
    await expect(pageIndicator).toHaveText(`2 / ${totalPagesStr}`);
    await expect(boundaryHint).toBeVisible();
    await expect(boundaryHint).toHaveText("もう一度タップで次の話へ");
    await expect(swipeTrack).toHaveCSS("transition-property", "none");

    // paged モードにおけるページ位置復元の検証（R1-18, AC-RD-19, AC-RD-20）
    // 第2ページ表示中に作品詳細へ戻り、再開した際に第2ページが復元されることを確認
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    const pagedResumeButton = page.getByTestId("detail-resume-button");
    await expect(pagedResumeButton).toBeVisible();
    await pagedResumeButton.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(readerView).toHaveAttribute("data-current-page", "2");
    await expect(pageIndicator).toHaveText(`2 / ${totalPagesStr}`);

    // 最終ページでの端 2 段階タップによる前後話遷移（AC-RD-18, TR-05）
    // 1 回目の左端タップ（幅約 20%）で案内ヒントが表示されることを確認
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.1,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(boundaryHint).toBeVisible();
    await expect(boundaryHint).toHaveText("もう一度タップで次の話へ");

    // 2.5 秒以内に 2 回目の左端タップを行うことで第 2 話へ遷移することを確認
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.1,
        readerBox.y + readerBox.height * 0.4,
      );
    }

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(boundaryHint).not.toBeVisible();
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    // 第2話の先頭ページでの端 2 段階タップ（右端タップ）による前話遷移および末尾ページ復元（AC-RD-18, TR-05）
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.9,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(boundaryHint).toBeVisible();
    await expect(boundaryHint).toHaveText("もう一度タップで前の話へ");

    // 2回目の右端タップで第1話へ復帰
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.9,
        readerBox.y + readerBox.height * 0.4,
      );
    }

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(boundaryHint).not.toBeVisible();
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );
    await expect(readerView).toHaveAttribute(
      "data-current-page",
      totalPagesStr,
    );
    await expect(pageIndicator).toHaveText(
      `${totalPagesStr} / ${totalPagesStr}`,
    );

    // 最終ページでのドラッグ離上によるシームレス次話遷移（第2話、AC-RD-18, TR-05）
    // 画面幅の30%以上左から右（→）へドラッグしてヒントバッジが表示されることを確認（右綴じ書籍準拠: R1-29）
    if (readerBox) {
      const startX = readerBox.x + 100;
      const startY = readerBox.y + readerBox.height * 0.4;
      const dragDistance = readerBox.width * 0.35;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + dragDistance, startY, { steps: 10 });
      await expect(boundaryHint).toBeVisible();
      await expect(boundaryHint).toHaveText("指を離して次の話へ");

      // 指（ポインター）を離すことで第2話へシームレス遷移することを確認
      await page.mouse.up();
    }

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(boundaryHint).not.toBeVisible();
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    // 第2話の先頭ページでの右から左（←）ドラッグ離上によるシームレス前話遷移および末尾ページ復元（R2-04, AC-RD-18, TR-05）
    if (readerBox) {
      const startX = readerBox.x + readerBox.width - 100;
      const startY = readerBox.y + readerBox.height * 0.4;
      const dragDistance = readerBox.width * 0.35;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - dragDistance, startY, { steps: 10 });
      await expect(boundaryHint).toBeVisible();
      await expect(boundaryHint).toHaveText("指を離して前の話へ");

      await page.mouse.up();
    }

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(boundaryHint).not.toBeVisible();
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );
    await expect(readerView).toHaveAttribute(
      "data-current-page",
      totalPagesStr,
    );
    await expect(pageIndicator).toHaveText(
      `${totalPagesStr} / ${totalPagesStr}`,
    );

    // 再度最終ページでの左から右（→）ドラッグ離上で第2話へ遷移
    if (readerBox) {
      const startX = readerBox.x + 100;
      const startY = readerBox.y + readerBox.height * 0.4;
      const dragDistance = readerBox.width * 0.35;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + dragDistance, startY, { steps: 10 });
      await page.mouse.up();
    }
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );

    // 下部オーバーレイの「前の話へ」ボタンで第1話へ戻る（TR-05）
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

    // 画面最下部ゾーンをタップしてオーバーレイをスライドイン表示（AC-RD-10, AC-RD-22）
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    await expect(topOverlay).toHaveClass(/translate-y-0/);
    await expect(page.getByTestId("reader-chapter-indicator")).toHaveText(
      "第 2 話 / 全 4 話",
    );
    await expect(page.getByTestId("reader-prev-chapter")).toBeEnabled();

    // 閉じるボタン（reader-bottom-overlay-close）は廃止され非表示/非存在であることを確認
    const overlayCloseButton = page.getByTestId("reader-bottom-overlay-close");
    await expect(overlayCloseButton).not.toBeAttached();

    // リーダー下部オーバーレイ内のタブ（本棚・検索・ランキング・設定）が表示されていることを確認
    await expect(page.getByTestId("reader-bottom-tab-bookshelf")).toBeVisible();
    await expect(page.getByTestId("reader-bottom-tab-search")).toBeVisible();
    await expect(page.getByTestId("reader-bottom-tab-ranking")).toBeVisible();
    await expect(page.getByTestId("reader-bottom-tab-settings")).toBeVisible();

    // 「前の話へ」ボタンで第1話へ戻り、末尾ページ（最終ページ）で開かれることを確認（R2-04, TR-05）
    await page.getByTestId("reader-prev-chapter").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(overlay).toHaveClass(/translate-y-full/);
    await expect(topOverlay).toHaveClass(/-translate-y-full/);
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );
    await expect(readerView).toHaveAttribute(
      "data-current-page",
      totalPagesStr,
    );
    await expect(pageIndicator).toHaveText(
      `${totalPagesStr} / ${totalPagesStr}`,
    );

    // 7. リーダー画面下部オーバーレイから設定画面（SCR-05）への遷移導線（TR-12）および戻り先保証（R1-03, R1-21）
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    await expect(topOverlay).toHaveClass(/translate-y-0/);
    const readerSettingsTab = page.getByTestId("reader-bottom-tab-settings");
    await expect(readerSettingsTab).toBeVisible();
    await readerSettingsTab.click();

    // 設定画面（/settings）へ遷移すること（TR-12）
    await expect(page).toHaveURL("/settings");
    await expect(settingsPage).toBeVisible();
    await expect(tabSettings).toHaveAttribute("aria-selected", "true");

    // 設定画面（SCR-05）での「スクロール」切替およびリーダーでの連続スクロール表示切替検証（AC-RD-15, AC-ST-13）
    const pagingModeSelect = page.getByTestId("paging-mode-select");
    await expect(pagingModeSelect).toBeVisible();
    // 初期値 auto は2択化により paged（ページめくり（縦書き時））として選択表示される (v0.5 Issue #168, #173)
    await expect(pagingModeSelect).toHaveValue("paged");
    await pagingModeSelect.selectOption("scroll");
    await expect(pagingModeSelect).toHaveValue("scroll");

    // 設定画面で選択中の「設定」タブを再タップしても重複履歴が追加されないことを確認（R1-21）
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");

    // ブラウザ戻る操作（TR-12）1回でリーダー画面（SCR-03）へ正しく復帰することを確認（R1-03, R1-21）
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(readerView).toBeVisible();

    // 設定画面での「スクロール」切替がリーダーに反映され、連続スクロール表示（overflow-x-auto）へ切り替わっていることを確認
    await expect(readerView).toHaveAttribute("data-paging-mode", "scroll");
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "scroll",
    );
    await expect(readerView).toHaveClass(/overflow-x-auto/);
    await expect(
      page.getByTestId("reader-page").locator("main"),
    ).not.toHaveClass(/touch-none/);
    // 連続スクロールモードではページインジケーター（reader-page-indicator）が非表示であること
    await expect(page.getByTestId("reader-page-indicator")).not.toBeAttached();

    // 8. 本文内の <ruby>（ルビ）および <em class="bouten">（傍点）が可視状態で正しくレンダリングされていることを確認
    const rubyElement = readerView.locator("ruby").first();
    await expect(rubyElement).toBeVisible();

    const boutenElement = readerView.locator("em.bouten").first();
    await expect(boutenElement).toBeVisible();
    await expect(boutenElement).toHaveText("信じがたい光景");

    // 縦書き連続スクロール時に scrollWidth > clientWidth となっており、左方向（負の scrollLeft）へスクロールして進捗を保存できることを確認（AC-RD-08, R1-01）
    // スクロール操作により上下オーバーレイが自動非表示（translate-y-full / -translate-y-full）になることを確認（AC-RD-10, AC-RD-22）
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    await expect(topOverlay).toHaveClass(/translate-y-0/);
    // 連続スクロールモードではシークバー領域が非表示であること（AC-RD-25）
    await expect(
      page.getByTestId("reader-page-seekbar-section"),
    ).not.toBeAttached();

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
    await expect(topOverlay).toHaveClass(/-translate-y-full/);

    // 縦書き連続スクロール時の本文先頭「前の話へ」ボタン・本文末尾「次の話へ」ボタンによる前後話遷移（AC-RD-19, TR-05）
    // 第1話では先頭「前の話へ」ボタンが無効（disabled）化されていることを確認
    const scrollPrevButton = page.getByTestId("reader-scroll-prev-chapter");
    const scrollNextButton = page.getByTestId("reader-scroll-next-chapter");
    await expect(scrollPrevButton).toBeVisible();
    await expect(scrollPrevButton).toBeDisabled();
    await expect(scrollNextButton).toBeVisible();
    await expect(scrollNextButton).toBeEnabled();

    // 末尾「次の話へ」ボタンをクリックして第2話へ遷移（TR-05 / AC-RD-19）
    await scrollNextButton.click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );

    // 第2話では先頭「前の話へ」ボタンが有効化されており、クリックして第1話へ戻ることを確認
    await expect(scrollPrevButton).toBeVisible();
    await expect(scrollPrevButton).toBeEnabled();
    await scrollPrevButton.click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );

    // 連続スクロールモードでの末尾到達後2段階操作（スワイプ/ホイール）による前後話遷移（AC-RD-19, TR-05）
    // 末尾（progress = 1.0）へスクロール
    await readerView.evaluate((el) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll > 0) {
        el.scrollLeft = -maxScroll;
        el.dispatchEvent(new Event("scroll"));
      }
    });
    // 1回目の末尾操作でヒントトースト表示
    await readerView.dispatchEvent("wheel", { deltaX: -50, deltaY: 0 });
    const boundaryToast = page.getByTestId("reader-episode-boundary-hint");
    await expect(boundaryToast).toBeVisible();
    await expect(boundaryToast).toHaveText("もう一度スワイプで次の話へ");

    // 2.5秒以内の2回目操作で次話（第2話）へ遷移
    await readerView.dispatchEvent("wheel", { deltaX: -50, deltaY: 0 });
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );

    // 第2話先頭（progress = 0.0）で前話への2段階操作を検証
    await readerView.evaluate((el) => {
      el.scrollLeft = 0;
      el.dispatchEvent(new Event("scroll"));
    });
    // 1回目の先頭操作でヒントトースト表示
    await readerView.dispatchEvent("wheel", { deltaX: 50, deltaY: 0 });
    await expect(boundaryToast).toBeVisible();
    await expect(boundaryToast).toHaveText("もう一度スワイプで前の話へ");

    // 2.5秒以内の2回目操作で前話（第1話）へ戻る
    await readerView.dispatchEvent("wheel", { deltaX: 50, deltaY: 0 });
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );

    // 再度設定画面へ遷移して横書きに切り替えた場合、自動的に連続スクロール固定となることを確認（AC-RD-15, SYS-REQ-11）
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    await readerSettingsTab.click();
    await expect(page).toHaveURL("/settings");
    await toggleOrientation.click(); // 横書きへ
    await expect(page.getByTestId("paging-mode-select")).toBeDisabled();
    await expect(page.getByTestId("paging-mode-note")).toBeVisible();
    await expect(page.getByTestId("paging-mode-note")).toHaveText(
      "※横書き表示時は連続スクロール固定となります",
    );

    // 縦書きへ戻す
    await toggleOrientation.click();
    await expect(page.getByTestId("paging-mode-select")).toBeEnabled();

    // リーダーへ復帰
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );

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

    // 最下部タッチゾーンをタップしてオーバーレイを再表示し、「次の話へ」（reader-next-chapter）で第2話へ遷移（TR-05 / AC-RD-06）
    await touchZone.click();
    await expect(overlay).toHaveClass(/translate-y-0/);
    const nextChapterButton = page.getByTestId("reader-next-chapter");
    await expect(nextChapterButton).toBeEnabled();
    await nextChapterButton.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(overlay).toHaveClass(/translate-y-full/);
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
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

    // 11. 目次画面（SCR-02）から設定画面（SCR-05）へ遷移し、ブラウザ戻る操作で目次画面へ復帰することを確認（TR-12 改善）
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");
    await expect(tabSettings).toHaveAttribute("aria-selected", "true");

    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();

    // どこからでも下部タブ「本棚」をタップした際、本棚トップ（/）へ直行することの確認（TR-01b）
    // 再度目次画面から「設定」タブをタップ
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

    // 14. 未存在作品・エピソードのリーダー画面 (/novels/non-existent/chapters/1) において、空状態（reader-empty）および上下オーバーレイ初期表示（translate-y-0）と「本棚」タブによる復帰を検証（AC-RD-10, AC-RD-22）
    await page.goto("/novels/kakuyomu:9999999999999999999/chapters/1");
    const readerEmpty = page.getByTestId("reader-empty");
    await expect(readerEmpty).toBeVisible();
    const errorOverlay = page.getByTestId("reader-bottom-overlay");
    await expect(errorOverlay).toHaveClass(/translate-y-0/);
    const errorTopOverlay = page.getByTestId("reader-top-overlay");
    await expect(errorTopOverlay).toHaveClass(/translate-y-0/);

    const errorBookshelfTab = page.getByTestId("reader-bottom-tab-bookshelf");
    await expect(errorBookshelfTab).toBeVisible();
    await errorBookshelfTab.click();

    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-empty")).toBeVisible();

    // 15. 本棚画面（/）での実機システム戻るボタン押下時の一時トースト表示および自動消去の検証（AC-AB-05, TR-13）
    await page.evaluate(() => {
      const bridge = (
        window as unknown as {
          __yommyAppBridge?: { triggerBackButton: () => Promise<void> };
        }
      ).__yommyAppBridge;
      if (bridge) {
        void bridge.triggerBackButton();
      }
    });

    const exitToast = page.getByTestId("exit-app-toast");
    await expect(exitToast).toBeVisible();
    await expect(exitToast).toHaveText(
      "もう一度バックボタンを押すと終了します",
    );

    // 2秒後にトーストが自動消滅することを確認
    await expect(exitToast).not.toBeVisible({ timeout: 4000 });

    // 本棚画面で2秒以内に連続2回戻るボタンを押下した場合は exitApp が呼び出されること（AC-AB-06, TR-13）
    await page.evaluate(async () => {
      const bridge = (
        window as unknown as {
          __yommyAppBridge?: { triggerBackButton: () => Promise<void> };
        }
      ).__yommyAppBridge;
      if (bridge) {
        await bridge.triggerBackButton();
        await bridge.triggerBackButton();
      }
    });

    const exitInfo = await page.evaluate(() => {
      const bridge = (
        window as unknown as {
          __yommyAppBridge?: {
            exitAppCalled: boolean;
            getExitAppCallCount?: () => number;
          };
        }
      ).__yommyAppBridge;
      return {
        exitAppCalled: bridge?.exitAppCalled,
        exitAppCount: bridge?.getExitAppCallCount?.(),
      };
    });
    expect(exitInfo.exitAppCalled).toBe(true);
    expect(exitInfo.exitAppCount).toBe(1);
  });

  test("設定画面での全フォント種別（5種）選択・画面余白（8px〜48px境界値）操作とサンプルプレビューおよびリーダー画面（縦書き・横書き）への組版反映が正常に機能する (AC-ST-17, AC-ST-18, AC-RD-21, SYS-REQ-09)", async ({
    page,
  }) => {
    // 1. 設定画面（/settings）へ遷移
    await page.goto("/settings");
    const settingsPage = page.getByTestId("settings-page");
    await expect(settingsPage).toBeVisible();

    // フッターバージョン表示の確認（AC-ST-20, v1.0 Issue #304）
    const versionFooter = page.getByTestId("settings-version-footer");
    await expect(versionFooter).toBeVisible();
    await expect(versionFooter).toHaveText("Yommy v1.0.0");

    const samplePreview = page.getByTestId("sample-text-preview");
    await expect(samplePreview).toBeVisible();

    const fontFamilySelect = page.getByTestId("font-family-select");
    await expect(fontFamilySelect).toBeVisible();

    // 2. 5種すべてのフォント種別（biz-ud-mincho, mincho, biz-ud-gothic, gothic, klee）の選択切り替えとプレビュー属性・スタイルの即時反映を検証
    const fontFamilies = [
      { id: "biz-ud-mincho", fontNameSnippet: "BIZ UDMincho" },
      { id: "mincho", fontNameSnippet: "Noto Serif CJK JP" },
      { id: "biz-ud-gothic", fontNameSnippet: "BIZ UDGothic" },
      { id: "gothic", fontNameSnippet: "Noto Sans CJK JP" },
      { id: "klee", fontNameSnippet: "Klee" },
    ] as const;

    for (const font of fontFamilies) {
      await fontFamilySelect.selectOption(font.id);
      await expect(samplePreview).toHaveAttribute("data-font-family", font.id);
      const previewStyle = await samplePreview.getAttribute("style");
      expect(previewStyle).toContain(font.fontNameSnippet);
    }

    // 3. 画面余白ステッパーの境界値操作（MIN: 8px, MAX: 48px）とプレビュー反映の検証
    const pageMarginDecrease = page.getByTestId("page-margin-decrease");
    const pageMarginIncrease = page.getByTestId("page-margin-increase");
    const pageMarginValue = page.getByTestId("page-margin-value");

    // (a) 最小値（8px）まで縮小: 20 -> 16 -> 12 -> 8 (3回クリック)
    for (let i = 0; i < 3; i++) {
      await pageMarginDecrease.click();
    }
    await expect(pageMarginValue).toHaveText("8px");
    await expect(pageMarginDecrease).toBeDisabled();
    await expect(samplePreview).toHaveAttribute("data-page-margin", "8");
    const minPreviewStyle = await samplePreview.getAttribute("style");
    expect(minPreviewStyle).toContain("padding: 8px");

    // (b) 最大値（48px）まで拡大: 8 -> 12 -> ... -> 48 (10回クリック)
    for (let i = 0; i < 10; i++) {
      await pageMarginIncrease.click();
    }
    await expect(pageMarginValue).toHaveText("48px");
    await expect(pageMarginIncrease).toBeDisabled();
    await expect(samplePreview).toHaveAttribute("data-page-margin", "48");
    const maxPreviewStyle = await samplePreview.getAttribute("style");
    expect(maxPreviewStyle).toContain("padding: 48px");

    // (c) 扱いやすい中間値（32px）へ調整（4回縮小: 48 -> 44 -> 40 -> 36 -> 32）し、フォントを 'biz-ud-gothic' に設定
    for (let i = 0; i < 4; i++) {
      await pageMarginDecrease.click();
    }
    await expect(pageMarginValue).toHaveText("32px");
    await fontFamilySelect.selectOption("biz-ud-gothic");
    await expect(samplePreview).toHaveAttribute(
      "data-font-family",
      "biz-ud-gothic",
    );
    await expect(samplePreview).toHaveAttribute("data-page-margin", "32");

    // 4. 設定の永続化確認（リロード後も維持されていること）
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady === true,
    );
    await expect(fontFamilySelect).toHaveValue("biz-ud-gothic");
    await expect(pageMarginValue).toHaveText("32px");
    await expect(samplePreview).toHaveAttribute(
      "data-font-family",
      "biz-ud-gothic",
    );
    await expect(samplePreview).toHaveAttribute("data-page-margin", "32");

    // 5. 作品データをシードしてリーダー画面（SCR-03）へ直接遷移
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const sampleUrl = "https://kakuyomu.jp/works/16817330658027210412";
      const response = await services.httpClient.getHtml({ url: sampleUrl });
      const parser = services.parserRegistry.requireParser(sampleUrl);
      const parsedIndex = parser.parseNovelIndex(response.html, sampleUrl);
      await services.novelRepository.upsertNovelWithToc(
        parsedIndex,
        new Date().toISOString(),
      );
    });

    await page.goto("/novels/kakuyomu:16817330658027210412/chapters/1");
    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();

    // 6. リーダー縦書きページめくり組版への反映確認
    await expect(readerView).toHaveAttribute(
      "data-font-family",
      "biz-ud-gothic",
    );
    await expect(readerView).toHaveAttribute("data-page-margin", "32");
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "paged",
    );

    const readerStyle = await readerView.getAttribute("style");
    expect(readerStyle).toContain("BIZ UDGothic");

    const readerContent = page.getByTestId("reader-content");
    await expect(readerContent).toBeVisible();
    // 縦書きページめくり組版時のマルチカラム column-gap は pageMarginPx * 2 = 64px
    const readerContentStyle = await readerContent.getAttribute("style");
    expect(readerContentStyle).toContain("column-gap: 64px");
    expect(readerContentStyle).toContain("columns: 1");
    expect(readerContentStyle).toContain("transform: translateY(0px)");

    // ページ送り（次ページへタップ）が正常に機能すること
    const readerBox = await readerView.boundingBox();
    expect(readerBox).not.toBeNull();
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.1,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(readerView).toHaveAttribute("data-current-page", "2");

    // 前ページへタップ
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.9,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    // 6b. 3ページ以上の長文エピソードにおける中間ページ（先頭でも末尾でもない第2ページ）での別画面遷移・再遷移時のページ位置復元検証（R1-26, AC-RD-20）
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const longBodyHtml = Array.from(
        { length: 40 },
        (_, idx) =>
          `<p>第${idx + 1}段落：これは複数ページにわたる縦書き長文エピソードの中間ページしおり復元を検証するためのテスト本文です。画面遷移後に再度リーダー画面を開いた際にも、初回0pxスロット計測やマルチパス計測で最終ページや先頭ページに化けることなく、元のページ番号が正確に復元されます。</p>`,
      ).join("");
      await services.chapterRepository.saveChapterBody(
        "kakuyomu:16817330658027210412",
        2,
        {
          remoteChapterId: "16817330658027210414",
          title: "第1話 見知らぬ空",
          url: "https://kakuyomu.jp/works/16817330658027210412/episodes/16817330658027210414",
          bodyHtml: longBodyHtml,
          byteSize: longBodyHtml.length,
        },
        new Date().toISOString(),
      );
    });

    await page.goto("/novels/kakuyomu:16817330658027210412/chapters/2");
    await expect(readerView).toBeVisible();
    await expect(readerView).toHaveAttribute(
      "data-total-pages",
      /^[3-9]\d*|^\d{2,}$/,
    );
    const ch2TotalPages = (await readerView.getAttribute("data-total-pages"))!;
    expect(Number(ch2TotalPages)).toBeGreaterThanOrEqual(3);

    // 左端タップで中間ページ（第2ページ / 全Nページ, 1 < 2 < N）へ移動
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.1,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await expect(readerView).toHaveAttribute("data-current-page", "2");
    await expect(page.getByTestId("reader-page-indicator")).toHaveText(
      `2 / ${ch2TotalPages}`,
    );

    // 中央タップでオーバーレイを開き、「← 目次」で作品詳細（SCR-02）へ移動してから「続きから読む」で再遷移（R1-26）
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.5,
        readerBox.y + readerBox.height * 0.4,
      );
    }
    await page.getByTestId("reader-top-back-to-toc").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    await page.getByTestId("detail-resume-button").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    // 最終ページ（ch2TotalPages）や第1ページに化けず、中間ページ（第2ページ）が正確に復元されること
    await expect(readerView).toHaveAttribute("data-total-pages", ch2TotalPages);
    await expect(readerView).toHaveAttribute("data-current-page", "2");
    await expect(page.getByTestId("reader-page-indicator")).toHaveText(
      `2 / ${ch2TotalPages}`,
    );

    // 7. 横書きスクロール表示時の余白スタイル反映確認
    // 設定画面へ移動して横書きへ切り替え
    await page.goto("/settings");
    const toggleOrientation = page.getByTestId("toggle-orientation");
    await toggleOrientation.click();
    await expect(samplePreview).toHaveAttribute(
      "data-writing-mode",
      "horizontal-tb",
    );

    // リーダーへ戻る
    await page.goto("/novels/kakuyomu:16817330658027210412/chapters/1");
    await expect(readerView).toBeVisible();
    await expect(readerView).toHaveAttribute(
      "data-writing-mode",
      "horizontal-tb",
    );
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "scroll",
    );
    await expect(readerView).toHaveAttribute(
      "data-font-family",
      "biz-ud-gothic",
    );
    await expect(readerView).toHaveAttribute("data-page-margin", "32");

    // 横書きスクロール時は container の padding が 32px
    const horizReaderStyle = await readerView.getAttribute("style");
    expect(horizReaderStyle).toContain("padding: 32px");
  });
});
