import { test, expect } from "@playwright/test";

test.describe("SCN-04: 読書中5話自動先読み・未取得話一括キャッシュ・キャッシュ鮮度フォールバック・キャッシュ容量管理シナリオ (HO-20, HO-21, HO-24)", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );
  });

  test("作品詳細画面で『未取得話を一括キャッシュ』を実行し、進捗表示と各話バッジの順次更新を経て全話キャッシュ完了状態になること (HO-21, AC-ND-11, AC-ND-12, AC-ND-13)", async ({
    page,
  }) => {
    // 1. サンプル作品（全4話、未取得状態）をシード登録
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
        window.__yommyServices.isReady,
    );

    // 2. 本棚から作品詳細画面へ遷移
    const novelCardSelect = page.getByTestId("novel-card-select");
    await expect(novelCardSelect).toBeVisible();
    await novelCardSelect.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    const novelDetailPage = page.getByTestId("novel-detail-page");
    await expect(novelDetailPage).toBeVisible();

    // 初期状態の確認: 全 4 話中 0 話取得済み、各話に「未取得」バッジ表示
    const detailStats = page.getByTestId("novel-detail-stats");
    await expect(detailStats).toContainText("全 4 話（取得済み 0 話");

    const uncachedBadges = page.getByTestId("episode-uncached-badge");
    await expect(uncachedBadges).toHaveCount(4);

    // 3. 「未取得話を一括キャッシュ」ボタンをクリックして一括キャッシュを開始
    const batchButton = page.getByTestId("batch-cache-button");
    await expect(batchButton).toBeVisible();
    await expect(batchButton).toHaveText("未取得話を一括キャッシュ");
    await batchButton.click();

    // 4. 進捗表示への切り替えおよび他操作の排他ロック確認 (AC-ND-12)
    const progressEl = page.getByTestId("batch-cache-progress");
    await expect(progressEl).toBeVisible();

    const startFromBeginningBtn = page.getByTestId("detail-read-first-button");
    const refreshTocBtn = page.getByTestId("refresh-toc-button");
    await expect(startFromBeginningBtn).toBeDisabled();
    await expect(refreshTocBtn).toBeDisabled();

    // 5. 直列順次取得が進み、全話キャッシュ完了（4 / 4 話取得済み）となるまで待機 (AC-ND-11, AC-ND-13)
    await expect(batchButton).toBeVisible({ timeout: 20000 });
    await expect(batchButton).toHaveText("全話キャッシュ済み");
    await expect(batchButton).toBeDisabled();

    // 取得件数が全話反映され、未取得バッジが 0 件になること
    await expect(detailStats).toContainText("全 4 話（取得済み 4 話");
    await expect(uncachedBadges).toHaveCount(0);
  });

  test("作品詳細画面での一括キャッシュ実行中に手動で中断し、処理が停止して取得済み話数が保持されること (HO-21, AC-ND-12)", async ({
    page,
  }) => {
    // 1. サンプル作品（全4話、未取得状態）をシード登録
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
        window.__yommyServices.isReady,
    );

    // 2. 作品詳細画面へ遷移
    await page.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    const batchButton = page.getByTestId("batch-cache-button");
    await expect(batchButton).toBeVisible();
    await batchButton.click();

    // 3. 中断ボタンが表示されたらクリックして即座に中断
    const cancelBtn = page.getByTestId("batch-cache-cancel-button");
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // 4. 進捗表示が消え、ボタンが「未取得話を一括キャッシュ」に戻ること
    await expect(page.getByTestId("batch-cache-progress")).not.toBeVisible();
    await expect(batchButton).toBeVisible();
    await expect(batchButton).toBeEnabled();

    // 排他ロックが解除されていること
    await expect(
      page.getByTestId("detail-read-first-button"),
    ).not.toBeDisabled();
    await expect(page.getByTestId("refresh-toc-button")).not.toBeDisabled();
  });

  test("リーダー第1話表示後にバックグラウンドで後続5話が自動先読みされ（上限超は未取得）、第2話へ遷移した際に即時描画されること (HO-20, AC-RD-12, AC-RD-13, R1-18)", async ({
    page,
  }) => {
    // 1. サンプル作品（全7話構成、未取得状態）をシード登録
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const sampleUrl = "https://kakuyomu.jp/works/16817330658027210412";
      const response = await services.httpClient.getHtml({ url: sampleUrl });
      const parser = services.parserRegistry.requireParser(sampleUrl);
      const parsedIndex = parser.parseNovelIndex(response.html, sampleUrl);

      // 7話分の目次データを構築
      const chapters7 = [];
      for (let i = 1; i <= 7; i++) {
        const episodeId = String(BigInt("16817330658027210412") + BigInt(i));
        chapters7.push({
          chapterIndex: i,
          remoteChapterId: episodeId,
          title: `第${i}話 テスト`,
          url: `https://kakuyomu.jp/works/16817330658027210412/episodes/${episodeId}`,
          publishedAt: "2026-01-01T10:00:00Z",
        });
      }

      await services.novelRepository.upsertNovelWithToc(
        {
          ...parsedIndex,
          totalChapters: 7,
          chapters: chapters7,
        },
        new Date().toISOString(),
      );
    });
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );

    // 2. 作品詳細画面から第1話リーダーを開く（SPA ナビゲーション）
    await page.getByTestId("novel-card-select").click();
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();
    await page.getByTestId("detail-read-first-button").click();

    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();

    // 3. バックグラウンド先読みにより第2話〜第6話（PREFETCH_COUNT=5話分）が SQLite に保存されるのを監視（HO-20, AC-RD-12, R1-18）
    await expect
      .poll(
        async () => {
          return await page.evaluate(async () => {
            const services = window.__yommyServices;
            if (!services) return false;
            const ch6 = await services.chapterRepository.getChapter(
              "kakuyomu:16817330658027210412",
              6,
            );
            return (
              ch6 !== null && ch6.downloadedAt !== null && ch6.bodyHtml !== null
            );
          });
        },
        { timeout: 25000 },
      )
      .toBe(true);

    // 第2話〜第6話が取得済みであり、第7話は先読み上限（5話）外のため未取得（downloadedAt === null）であることを検証
    const chaptersStatus = await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const results: { index: number; downloaded: boolean }[] = [];
      for (let i = 2; i <= 7; i++) {
        const ch = await services.chapterRepository.getChapter(
          "kakuyomu:16817330658027210412",
          i,
        );
        results.push({
          index: i,
          downloaded: ch !== null && ch.downloadedAt !== null,
        });
      }
      return results;
    });

    for (let i = 2; i <= 6; i++) {
      const s = chaptersStatus.find((item) => item.index === i);
      expect(s?.downloaded).toBe(true);
    }
    const ch7Status = chaptersStatus.find((item) => item.index === 7);
    expect(ch7Status?.downloaded).toBe(false);

    // 4. 下部タッチゾーンをタップしてオーバーレイを表示
    const touchZone = page.getByTestId("reader-bottom-touch-zone");
    await touchZone.click();
    const overlay = page.getByTestId("reader-bottom-overlay");
    await expect(overlay).toHaveClass(/translate-y-0/);

    // 「次の話」ボタンで第2話へ遷移
    const nextBtn = page.getByTestId("reader-next-chapter");
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // 5. キャッシュ済みのため、通信待機なく第2話が即座に表示されること (AC-RD-13)
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(readerView).toBeVisible();
  });

  test("7日経過した古いキャッシュが存在する場合、SHORT_TIMEOUT_MS（3秒）超過時にエラー画面を出さず既存キャッシュ本文が表示されること (HO-21, AC-RD-13, R1-18)", async ({
    page,
  }) => {
    // 1. サンプル作品をシード登録し、第1話に 8日前の古いキャッシュを設定
    const oldDateStr = new Date(
      Date.now() - (7 * 24 * 60 * 60 * 1000 + 3600 * 1000),
    ).toISOString();
    const staleContentHtml =
      "<p>これは8日前の古いキャッシュ本文です。フォールバック表示されます。</p>";

    await page.evaluate(
      async ({ oldDate, bodyHtml }) => {
        const services = window.__yommyServices!;
        const sampleUrl = "https://kakuyomu.jp/works/16817330658027210412";
        const response = await services.httpClient.getHtml({ url: sampleUrl });
        const parser = services.parserRegistry.requireParser(sampleUrl);
        const parsedIndex = parser.parseNovelIndex(response.html, sampleUrl);
        await services.novelRepository.upsertNovelWithToc(
          parsedIndex,
          new Date().toISOString(),
        );

        // 第1話のキャッシュを古い日付・特定本文で直接保存
        await services.chapterRepository.saveChapterBody(
          "kakuyomu:16817330658027210412",
          1,
          {
            remoteChapterId: "16817330658027210413",
            title: "プロローグ",
            bodyHtml,
            byteSize: bodyHtml.length,
            prevChapterUrl: null,
            nextChapterUrl: null,
          },
          oldDate,
        );
      },
      { oldDate: oldDateStr, bodyHtml: staleContentHtml },
    );
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );

    // 2. HTTP クライアントのエピソード取得をモックし、SHORT_TIMEOUT_MS（3秒）を超える遅延（3500ms）を発生させる
    await page.evaluate(() => {
      const services = window.__yommyServices!;
      const client = services.httpClient as unknown as {
        setResponse?: (
          pattern: RegExp,
          handler: (options: { url: string }) => Promise<unknown>,
        ) => void;
      };
      client.setResponse?.(
        /^https:\/\/kakuyomu\.jp\/works\/\d+\/episodes\/\d+/,
        async (options) => {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return { status: 200, url: options.url, headers: {}, html: "" };
        },
      );
    });

    // 3. 本棚から作品詳細を経て第1話リーダー画面を開く（SPA ナビゲーションでモック状態を維持）
    await page.getByTestId("novel-card-select").click();
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();
    await page.getByTestId("detail-read-first-button").click();

    // 4. 3秒の短タイムアウト後にエラー画面にならず、古いキャッシュ本文がフォールバック表示されることを確認 (AC-RD-13)
    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("reader-error")).not.toBeVisible();
    await expect(readerView).toContainText(
      "これは8日前の古いキャッシュ本文です。フォールバック表示されます。",
    );
  });

  test("作品詳細画面でのキャッシュ容量表示と本文キャッシュ整理（既読話のみ／全話）および設定画面での全体キャッシュ集計・一括削除が正常に動作すること (AC-ND-20, AC-ND-21, AC-ND-22, AC-ST-14, AC-ST-15, AC-ST-16, HO-24, TR-19, TR-20)", async ({
    page,
  }) => {
    test.setTimeout(60000);

    // 1. サンプル作品（全4話、未取得状態）をシード登録
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
        window.__yommyServices.isReady,
    );

    // 2. 本棚から作品詳細画面へ遷移し、初期容量（0 B）およびボタン状態を確認 (AC-ND-20, AC-ND-21)
    const novelCardSelect = page.getByTestId("novel-card-select");
    await expect(novelCardSelect).toBeVisible();
    await novelCardSelect.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    const novelDetailPage = page.getByTestId("novel-detail-page");
    await expect(novelDetailPage).toBeVisible();

    const detailStats = page.getByTestId("novel-detail-stats");
    await expect(detailStats).toContainText("全 4 話（取得済み 0 話 / 0 B）");

    const clearCacheBtn = page.getByTestId("open-clear-cache-dialog-button");
    await expect(clearCacheBtn).toBeVisible();
    await expect(clearCacheBtn).toBeDisabled();

    const uncachedBadges = page.getByTestId("episode-uncached-badge");
    await expect(uncachedBadges).toHaveCount(4);

    // 3. 一括キャッシュを実行し、全話取得後に容量が表示されボタンが活性化すること (AC-ND-20)
    const batchButton = page.getByTestId("batch-cache-button");
    await batchButton.click();
    await expect(batchButton).toHaveText("全話キャッシュ済み", {
      timeout: 20000,
    });

    await expect(detailStats).toContainText("全 4 話（取得済み 4 話 / ");
    await expect(detailStats).not.toContainText("0 B）");
    await expect(clearCacheBtn).toBeEnabled();
    await expect(uncachedBadges).toHaveCount(0);

    // 4. 第1話・第2話を既読に設定し、画面をリロードして反映確認
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      await services.chapterRepository.markChapterRead(
        "kakuyomu:16817330658027210412",
        1,
        true,
      );
      await services.chapterRepository.markChapterRead(
        "kakuyomu:16817330658027210412",
        2,
        true,
      );
      await services.novelRepository.updateBookmark(
        "kakuyomu:16817330658027210412",
        2,
        0.5,
      );
    });
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );
    await expect(novelDetailPage).toBeVisible();

    const readBadges = page.getByTestId("episode-read-badge");
    await expect(readBadges).toHaveCount(2);

    const resumeButton = page.getByTestId("detail-resume-button");
    const bookmarkBadges = page.getByTestId("episode-bookmark-badge");
    await expect(resumeButton).toBeVisible();
    await expect(bookmarkBadges).toHaveCount(1);

    // 5. 「本文キャッシュ整理」ダイアログのキャンセル動作確認
    await clearCacheBtn.click();
    const clearDialog = page.getByTestId("clear-cache-confirm-dialog");
    await expect(clearDialog).toBeVisible();

    const cancelClearBtn = page.getByTestId("cancel-clear-cache-button");
    await cancelClearBtn.click();
    await expect(clearDialog).not.toBeVisible();

    // 6. 「既読話の本文キャッシュのみ削除」を実行 (AC-ND-21, AC-ND-22, TR-19)
    await clearCacheBtn.click();
    await expect(clearDialog).toBeVisible();

    const confirmClearReadBtn = page.getByTestId(
      "confirm-clear-read-cache-button",
    );
    await confirmClearReadBtn.click();
    await expect(clearDialog).not.toBeVisible();

    // 通知メッセージの表示と容量・話数の即時反映
    const noticeEl = page.getByTestId("novel-detail-notice");
    await expect(noticeEl).toBeVisible();
    await expect(noticeEl).toContainText("本文キャッシュを削除しました（2話）");

    await expect(detailStats).toContainText("全 4 話（取得済み 2 話 / ");
    await expect(detailStats).not.toContainText("0 B）");

    // 既読状態が保持されたまま、第1話・第2話のみ未取得バッジに戻っていること (AC-ND-22)
    await expect(readBadges).toHaveCount(2);
    await expect(uncachedBadges).toHaveCount(2);

    // キャッシュ削除後もしおり位置および「続きから読む」ボタンが保持されること (AC-ND-22)
    await expect(resumeButton).toBeVisible();
    await expect(bookmarkBadges).toHaveCount(1);

    const cachedBadges = page.getByTestId("episode-cached-badge");
    await expect(cachedBadges).toHaveCount(2);

    // 7. 「すべての本文キャッシュを削除」を実行 (AC-ND-21, AC-ND-22, TR-19)
    await clearCacheBtn.click();
    await expect(clearDialog).toBeVisible();

    const confirmClearAllBtn = page.getByTestId(
      "confirm-clear-all-cache-button",
    );
    await confirmClearAllBtn.click();
    await expect(clearDialog).not.toBeVisible();

    await expect(noticeEl).toContainText("本文キャッシュを削除しました（2話）");
    await expect(detailStats).toContainText("全 4 話（取得済み 0 話 / 0 B）");

    // 全話未取得に戻り、既読状態は保持され、削除ボタンが非活性となること
    await expect(readBadges).toHaveCount(2);
    await expect(uncachedBadges).toHaveCount(4);
    // 全話キャッシュ削除後もしおり位置および「続きから読む」ボタンが保持されること (AC-ND-22)
    await expect(resumeButton).toBeVisible();
    await expect(bookmarkBadges).toHaveCount(1);
    await expect(clearCacheBtn).toBeDisabled();
    await expect(batchButton).toBeEnabled();
    await expect(batchButton).toHaveText("未取得話を一括キャッシュ");

    // 8. 再度全話キャッシュを取得し、設定画面（SCR-05）の動作検証へ進む
    await batchButton.click();
    await expect(batchButton).toHaveText("全話キャッシュ済み", {
      timeout: 20000,
    });
    await expect(detailStats).toContainText("全 4 話（取得済み 4 話 / ");

    // 9. 下部タブから設定画面（SCR-05）へ遷移 (TR-12, AC-ST-14)
    const tabSettings = page.getByTestId("tab-settings");
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");

    const settingsPage = page.getByTestId("settings-page");
    await expect(settingsPage).toBeVisible();

    const storageCacheSection = page.getByTestId("storage-cache-section");
    await expect(storageCacheSection).toBeVisible();

    const storageCacheSummary = page.getByTestId("storage-cache-summary");
    await expect(storageCacheSummary).toContainText(
      "キャッシュ済み: 全 4 話（合計 ",
    );
    await expect(storageCacheSummary).not.toContainText("0 B）");

    const openGlobalClearBtn = page.getByTestId(
      "open-global-clear-cache-dialog-button",
    );
    await expect(openGlobalClearBtn).toBeEnabled();

    // 10. 全体一括削除ダイアログのキャンセル確認
    await openGlobalClearBtn.click();
    const globalDialog = page.getByTestId("global-clear-cache-dialog");
    await expect(globalDialog).toBeVisible();

    const cancelGlobalBtn = page.getByTestId(
      "cancel-global-clear-cache-button",
    );
    await cancelGlobalBtn.click();
    await expect(globalDialog).not.toBeVisible();

    // 11. 設定画面での「既読話の本文キャッシュのみ削除」実行 (AC-ST-15, AC-ST-16, TR-20)
    await openGlobalClearBtn.click();
    await expect(globalDialog).toBeVisible();

    const confirmGlobalReadBtn = page.getByTestId(
      "confirm-global-clear-read-cache-button",
    );
    await confirmGlobalReadBtn.click();
    await expect(globalDialog).not.toBeVisible();

    const storageNotice = page.getByTestId("storage-cache-notice");
    await expect(storageNotice).toBeVisible();
    await expect(storageNotice).toContainText(
      "本文キャッシュを一括削除しました（2話）",
    );
    await expect(storageCacheSummary).toContainText(
      "キャッシュ済み: 全 2 話（合計 ",
    );
    await expect(storageCacheSummary).not.toContainText("0 B）");

    // 12. 設定画面での「すべての本文キャッシュを削除」実行 (AC-ST-15, AC-ST-16, TR-20)
    await openGlobalClearBtn.click();
    await expect(globalDialog).toBeVisible();

    const confirmGlobalAllBtn = page.getByTestId(
      "confirm-global-clear-all-cache-button",
    );
    await confirmGlobalAllBtn.click();
    await expect(globalDialog).not.toBeVisible();

    await expect(storageNotice).toContainText(
      "本文キャッシュを一括削除しました（2話）",
    );
    await expect(storageCacheSummary).toContainText(
      "キャッシュ済み: 全 0 話（合計 0 B）",
    );
    await expect(openGlobalClearBtn).toBeDisabled();

    // 13. 本棚から作品詳細画面へ戻り、全話未取得・容量0 B・既読およびしおり位置保持が画面横断で整合していることを確認 (AC-ST-16)
    const tabBookshelf = page.getByTestId("tab-bookshelf");
    await tabBookshelf.click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("novel-card-bookmark")).toHaveText(
      "しおり: 第2話",
    );

    await novelCardSelect.click();
    await expect(novelDetailPage).toBeVisible();
    await expect(detailStats).toContainText("全 4 話（取得済み 0 話 / 0 B）");
    await expect(readBadges).toHaveCount(2);
    await expect(uncachedBadges).toHaveCount(4);
    await expect(clearCacheBtn).toBeDisabled();
    await expect(page.getByTestId("detail-resume-button")).toBeVisible();
    await expect(page.getByTestId("episode-bookmark-badge")).toHaveCount(1);
  });
});
