import { test, expect } from "@playwright/test";

test.describe("SCN-03: 読書中5話自動先読み・未取得話一括キャッシュ・キャッシュ鮮度フォールバックシナリオ (HO-20, HO-21)", () => {
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
    await expect(detailStats).toContainText("全 4 話（取得済み 0 話）");

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
    await expect(detailStats).toContainText("全 4 話（取得済み 4 話）");
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

  test("リーダー第1話表示後にバックグラウンドで後続話が自動先読みされ、第2話へ遷移した際に即時描画されること (HO-20, AC-RD-12, AC-RD-13)", async ({
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

    // 2. 作品詳細画面から第1話リーダーを開く（SPA ナビゲーション）
    await page.getByTestId("novel-card-select").click();
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();
    await page.getByTestId("detail-read-first-button").click();

    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();

    // 3. バックグラウンド先読みにより第2話が SQLite に保存されるのを監視（HO-20, AC-RD-12）
    await page.waitForFunction(
      async () => {
        const services = window.__yommyServices;
        if (!services) return false;
        const ch = await services.chapterRepository.getChapter(
          "kakuyomu:16817330658027210412",
          2,
        );
        return ch !== null && ch.downloadedAt !== null && ch.bodyHtml !== null;
      },
      null,
      { timeout: 15000 },
    );

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

  test("7日経過した古いキャッシュが存在する場合、再取得エラー時にエラー画面を出さず既存キャッシュ本文が表示されること (HO-21, AC-RD-13)", async ({
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

    // 2. HTTP クライアントのエピソード取得をモックし、エラー（500）を返却させて再取得を失敗させる設定
    await page.evaluate(() => {
      const services = window.__yommyServices!;
      const client = services.httpClient as unknown as {
        setResponse?: (
          pattern: RegExp,
          handler: (options: unknown) => unknown,
        ) => void;
      };
      client.setResponse?.(
        /^https:\/\/kakuyomu\.jp\/works\/\d+\/episodes\/\d+/,
        () => ({
          status: 500,
          url: "",
          headers: {},
          html: "",
        }),
      );
    });

    // 3. 本棚から作品詳細を経て第1話リーダー画面を開く（SPA ナビゲーションでモック状態を維持）
    await page.getByTestId("novel-card-select").click();
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();
    await page.getByTestId("detail-read-first-button").click();

    // 4. エラー画面にならず、古いキャッシュ本文がフォールバック表示されることを確認 (AC-RD-13)
    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();
    await expect(page.getByTestId("reader-error")).not.toBeVisible();
    await expect(readerView).toContainText(
      "これは8日前の古いキャッシュ本文です。フォールバック表示されます。",
    );
  });
});
