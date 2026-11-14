import { test, expect, type Page } from "@playwright/test";

const SAMPLE_KAKUYOMU_WORK_URL =
  "https://kakuyomu.jp/works/16817330658027210412";
const SAMPLE_KAKUYOMU_NOVEL_ID = "kakuyomu:16817330658027210412";

interface MockHttpClientHandle {
  setResponse: (
    urlPattern: string | RegExp,
    response:
      | {
          status?: number;
          url?: string;
          html?: string;
          headers?: Record<string, string>;
        }
      | ((options: {
          url: string;
          timeoutMs?: number;
          signal?: AbortSignal;
        }) =>
          | {
              status?: number;
              url?: string;
              html?: string;
              headers?: Record<string, string>;
            }
          | Promise<{
              status?: number;
              url?: string;
              html?: string;
              headers?: Record<string, string>;
            }>),
  ) => void;
}

interface ChapterLatchController {
  isStarted: (chapterIndex: number) => boolean;
  release: (chapterIndexes: number[]) => void;
}

type LatchWindow = Window & {
  __testCacheLatches?: ChapterLatchController;
  __rewindSnapshots?: Array<{ status: string; retryCount: number }>;
};

async function openNovelDetailMenu(page: Page): Promise<void> {
  const menuButton = page.getByTestId("novel-detail-menu-button");
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toBeEnabled();
  await menuButton.click();
  await expect(page.getByTestId("novel-detail-menu")).toBeVisible();
}

async function seedKakuyomuNovelAndOpenDetail(
  page: Page,
  totalChapters?: number,
): Promise<void> {
  await page.evaluate(
    async ({ sampleUrl, customChapterCount }) => {
      const services = window.__yommyServices!;
      const response = await services.httpClient.getHtml({ url: sampleUrl });
      const parser = services.parserRegistry.requireParser(sampleUrl);
      const parsedIndex = parser.parseNovelIndex(response.html, sampleUrl);

      if (typeof customChapterCount === "number") {
        const chapters = [];
        for (let i = 1; i <= customChapterCount; i++) {
          const episodeId = String(BigInt("16817330658027210412") + BigInt(i));
          chapters.push({
            chapterIndex: i,
            remoteChapterId: episodeId,
            partTitle: null,
            title: `第${i}話 テスト`,
            url: `${sampleUrl}/episodes/${episodeId}`,
            publishedAt: "2026-01-01T10:00:00Z",
          });
        }
        await services.novelRepository.upsertNovelWithToc(
          {
            ...parsedIndex,
            chapters,
          },
          new Date().toISOString(),
        );
      } else {
        await services.novelRepository.upsertNovelWithToc(
          parsedIndex,
          new Date().toISOString(),
        );
      }
    },
    { sampleUrl: SAMPLE_KAKUYOMU_WORK_URL, customChapterCount: totalChapters },
  );

  await page.reload();
  await page.waitForFunction(
    () =>
      typeof window.__yommyServices !== "undefined" &&
      window.__yommyServices.isReady,
  );

  const novelCardSelect = page.getByTestId("novel-card-select");
  await expect(novelCardSelect).toBeVisible();
  await novelCardSelect.click();

  await expect(page).toHaveURL(
    /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
  );
  await expect(page.getByTestId("novel-detail-page")).toBeVisible();
}

async function installChapterLatches(
  page: Page,
  options: {
    heldChapters?: number[];
    holdFirstCallChapters?: number[];
    customBodies?: Record<number, string>;
  },
): Promise<void> {
  await page.evaluate(
    async ({
      novelId,
      heldChapters = [],
      holdFirstCallChapters = [],
      customBodies = {},
    }) => {
      const services = window.__yommyServices!;
      const chapters =
        await services.chapterRepository.listChaptersByNovelId(novelId);
      const client = services.httpClient as unknown as MockHttpClientHandle;
      const sampleRes = await services.httpClient.getHtml({
        url: chapters[0].url,
      });
      const defaultHtml = sampleRes.html;

      const heldSet = new Set(heldChapters);
      const holdFirstSet = new Set(holdFirstCallChapters);
      const releasedSet = new Set<number>();
      const callCounts = new Map<number, number>();
      const waiters = new Map<number, Array<() => void>>();

      for (const ch of chapters) {
        const customText = customBodies[ch.chapterIndex];
        const shouldWrap =
          heldSet.has(ch.chapterIndex) ||
          holdFirstSet.has(ch.chapterIndex) ||
          customText !== undefined;
        if (!shouldWrap) {
          continue;
        }

        const html =
          customText !== undefined
            ? `<div class="widget-episodeBody js-episode-body"><p>${customText}</p></div>`
            : defaultHtml;

        client.setResponse(ch.url, async (reqOptions) => {
          const nextCount = (callCounts.get(ch.chapterIndex) ?? 0) + 1;
          callCounts.set(ch.chapterIndex, nextCount);

          const shouldHold =
            !releasedSet.has(ch.chapterIndex) &&
            (heldSet.has(ch.chapterIndex) ||
              (holdFirstSet.has(ch.chapterIndex) && nextCount === 1));

          if (shouldHold) {
            await new Promise<void>((resolve) => {
              const queue = waiters.get(ch.chapterIndex) ?? [];
              queue.push(resolve);
              waiters.set(ch.chapterIndex, queue);
            });
          } else if (holdFirstSet.has(ch.chapterIndex) && nextCount > 1) {
            const pendingFirst = waiters.get(ch.chapterIndex) ?? [];
            waiters.delete(ch.chapterIndex);
            for (const resolve of pendingFirst) {
              resolve();
            }
          }

          return {
            status: 200,
            url: reqOptions.url,
            headers: {},
            html,
          };
        });
      }

      (window as LatchWindow).__testCacheLatches = {
        isStarted: (chapterIndex: number) =>
          (callCounts.get(chapterIndex) ?? 0) > 0,
        release: (chapterIndexes: number[]) => {
          for (const idx of chapterIndexes) {
            releasedSet.add(idx);
            const resolvers = waiters.get(idx) ?? [];
            waiters.delete(idx);
            for (const resolve of resolvers) {
              resolve();
            }
          }
        },
      };
    },
    {
      novelId: SAMPLE_KAKUYOMU_NOVEL_ID,
      heldChapters: options.heldChapters ?? [],
      holdFirstCallChapters: options.holdFirstCallChapters ?? [],
      customBodies: options.customBodies ?? {},
    },
  );
}

async function releaseChapterLatches(
  page: Page,
  chapterIndexes: number[],
): Promise<void> {
  await page.evaluate((indexes) => {
    (window as LatchWindow).__testCacheLatches?.release(indexes);
  }, chapterIndexes);
}

test.describe("SCN-04: 読書中5話自動先読み・未取得話一括キャッシュ・永続キュー中断再開・再試行・キャッシュ鮮度フォールバック・キャッシュ容量管理シナリオ (HO-20, HO-21, HO-24, Issue #268, Issue #344, AC-ND-29, AC-ND-30, AC-RD-35)", () => {
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

    // 3. 3点メニューを開き、「未取得話を一括キャッシュ」をクリックして一括キャッシュを開始
    await openNovelDetailMenu(page);
    const batchButton = page.getByTestId("batch-cache-button");
    await expect(batchButton).toBeVisible();
    await expect(batchButton).toHaveText("未取得話を一括キャッシュ");
    await batchButton.click();
    await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

    // 4. インライン進捗表示・中断ボタン表示への切り替えおよび非ブロッキング操作確認 (AC-ND-12, AC-ND-27)
    const progressEl = page.getByTestId("batch-cache-progress");
    await expect(progressEl).toBeVisible();
    await expect(page.getByTestId("batch-cache-cancel-button")).toBeVisible();

    const startFromBeginningBtn = page.getByTestId("detail-read-first-button");
    const refreshTocBtn = page.getByTestId("refresh-toc-button");
    const menuBtn = page.getByTestId("novel-detail-menu-button");
    await expect(startFromBeginningBtn).toBeEnabled();
    await expect(refreshTocBtn).toBeEnabled();
    await expect(menuBtn).toBeEnabled();
    await openNovelDetailMenu(page);
    await expect(batchButton).toBeVisible();
    await expect(batchButton).toHaveText("一括キャッシュ実行中...");
    await expect(batchButton).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

    // 5. バックグラウンド順次取得が進み、全話キャッシュ完了（4 / 4 話取得済み）となるまで待機 (AC-ND-11, AC-ND-13)
    await expect(progressEl).not.toBeVisible({ timeout: 20000 });
    await expect(menuBtn).toBeEnabled();
    await openNovelDetailMenu(page);
    await expect(batchButton).toBeVisible();
    await expect(batchButton).toHaveText("全話キャッシュ済み");
    await expect(batchButton).toBeDisabled();

    // 取得件数が全話反映され、未取得バッジが 0 件になること
    await expect(detailStats).toContainText("全 4 話（取得済み 4 話");
    await expect(uncachedBadges).toHaveCount(0);
  });

  test("作品詳細画面での一括キャッシュ実行中に手動で中断し、処理が停止して取得済み話数が保持されること (HO-21, AC-ND-12)", async ({
    page,
  }) => {
    // 1. サンプル作品（全4話、未取得状態）をシード登録して詳細画面へ遷移し、第2話の取得をラッチで保持
    await seedKakuyomuNovelAndOpenDetail(page);
    await installChapterLatches(page, { heldChapters: [2] });

    await openNovelDetailMenu(page);
    const batchButton = page.getByTestId("batch-cache-button");
    await expect(batchButton).toBeVisible();
    await batchButton.click();
    await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

    // 2. 第1話完了後に第2話が downloading かつラッチ到達状態になるまで決定論的に待機
    const cancelBtn = page.getByTestId("batch-cache-cancel-button");
    await expect(cancelBtn).toBeVisible();
    await expect
      .poll(
        async () => {
          return await page.evaluate(async (novelId) => {
            const services = window.__yommyServices;
            if (!services) return false;
            const ch1 = await services.chapterRepository.getChapter(novelId, 1);
            const queue = await services.queueRepository.listByNovelId(novelId);
            const ch2 = queue.find((item) => item.chapterIndex === 2);
            const started =
              (window as LatchWindow).__testCacheLatches?.isStarted(2) ?? false;
            return (
              ch1 !== null &&
              ch1.bodyHtml !== null &&
              ch2?.status === "downloading" &&
              started
            );
          }, SAMPLE_KAKUYOMU_NOVEL_ID);
        },
        { timeout: 15000 },
      )
      .toBe(true);

    // 3. ヘッダーの中断ボタンをクリックして即座に中断
    await cancelBtn.click();

    // 4. 進捗表示が消え、排他ロックが解除され、3点メニュー内が「キャッシュを再開（残り3話）」に切り替わること (AC-ND-24, AC-ND-27)
    await expect(page.getByTestId("batch-cache-progress")).not.toBeVisible();
    await expect(
      page.getByTestId("detail-read-first-button"),
    ).not.toBeDisabled();
    await expect(page.getByTestId("refresh-toc-button")).not.toBeDisabled();
    await expect(page.getByTestId("novel-detail-stats")).toContainText(
      "全 4 話（取得済み 1 話",
    );
    await openNovelDetailMenu(page);
    await expect(batchButton).toBeVisible();
    await expect(batchButton).toBeEnabled();
    await expect(batchButton).toHaveText("キャッシュを再開（残り3話）");

    // 保留していた第2話ラッチを解放してからリロード
    await releaseChapterLatches(page, [2]);

    // 5. 画面リロード後も download_queue の永続状態から「キャッシュを再開（残り3話）」が復元されること
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );
    await openNovelDetailMenu(page);
    await expect(batchButton).toBeVisible();
    await expect(batchButton).toBeEnabled();
    await expect(batchButton).toHaveText("キャッシュを再開（残り3話）");

    // 6. 「キャッシュを再開」をクリックして全件取得完了すること
    await batchButton.click();
    await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();
    await expect(page.getByTestId("batch-cache-progress")).not.toBeVisible({
      timeout: 20000,
    });
    await openNovelDetailMenu(page);
    await expect(batchButton).toHaveText("全話キャッシュ済み");
    await expect(batchButton).toBeDisabled();

    // 7. download_queue が空にクリーンアップされていること
    const queueLength = await page.evaluate(async (novelId) => {
      const services = window.__yommyServices!;
      const items = await services.queueRepository.listByNovelId(novelId);
      return items.length;
    }, SAMPLE_KAKUYOMU_NOVEL_ID);
    expect(queueLength).toBe(0);
  });

  test("一括キャッシュ中の特定話通信エラー時に後続話の取得を継続し、取得失敗バッジ・再試行ボタン表示を経て再試行で全話完了およびキューがクリーンアップされること (AC-ND-25, SYS-REQ-02, SYS-REQ-03, TR-18)", async ({
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

    // 遷移後のページで第2話のURLを HTTP 500 エラーに設定
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const chapters = await services.chapterRepository.listChaptersByNovelId(
        "kakuyomu:16817330658027210412",
      );
      const ch2 = chapters.find((c) => c.chapterIndex === 2);
      if (ch2) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (services.httpClient as any).setResponse(ch2.url, () => {
          throw new Error("HTTP 500 Internal Server Error");
        });
      }
    });

    await openNovelDetailMenu(page);
    const batchButton = page.getByTestId("batch-cache-button");
    await expect(batchButton).toBeVisible();
    await expect(batchButton).toHaveText("未取得話を一括キャッシュ");
    await batchButton.click();

    // 3. 取得ループが完了し、ヘッダーにエラー通知が表示されるまで待機（後続話の取得がスキップ継続されるため）
    const errorNotice = page.getByTestId("novel-detail-error");
    await expect(errorNotice).toBeVisible({ timeout: 20000 });
    await expect(errorNotice).toContainText(
      "1話の取得に失敗しました（再試行可能）",
    );

    // 4. 3点メニュー内が「失敗した話を再試行（1話）」に切り替わっていること
    await openNovelDetailMenu(page);
    await expect(batchButton).toBeVisible();
    await expect(batchButton).toBeEnabled();
    await expect(batchButton).toHaveText("失敗した話を再試行（1話）");

    // 5. 第2話のエピソード行に「取得失敗」バッジが表示され、第1, 3, 4話は「取得済み」になっていること
    const failedBadges = page.getByTestId("episode-failed-badge");
    await expect(failedBadges).toHaveCount(1);

    const ep2Item = page.locator('[data-chapter-index="2"]');
    await expect(ep2Item.getByTestId("episode-failed-badge")).toBeVisible();
    await expect(ep2Item.getByTestId("episode-failed-badge")).toHaveText(
      "取得失敗",
    );

    const cachedBadges = page.getByTestId("episode-cached-badge");
    await expect(cachedBadges).toHaveCount(3);

    // 6. 第2話の通信エラーを解除（200 正常レスポンスを復元）
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const chapters = await services.chapterRepository.listChaptersByNovelId(
        "kakuyomu:16817330658027210412",
      );
      const ch2 = chapters.find((c) => c.chapterIndex === 2);
      if (ch2) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (services.httpClient as any).setResponse(ch2.url, {
          status: 200,
          url: ch2.url,
          html: '<div class="widget-episodeBody"><p>第2話本文の再試行取得成功</p></div>',
          headers: {},
        });
      }
    });

    // 7. 3点メニュー内の「失敗した話を再試行（1話）」をクリック
    await batchButton.click();
    await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

    // 8. 再試行が成功し、3点メニュー内で「全話キャッシュ済み」になること
    await expect(page.getByTestId("batch-cache-progress")).not.toBeVisible({
      timeout: 20000,
    });
    await openNovelDetailMenu(page);
    await expect(batchButton).toHaveText("全話キャッシュ済み");
    await expect(batchButton).toBeDisabled();

    // 9. 全話（4話）が取得済みになり、失敗バッジが 0 件になること
    await expect(cachedBadges).toHaveCount(4);
    await expect(failedBadges).toHaveCount(0);

    // 10. download_queue が空にクリーンアップされていること (R1-09)
    await expect
      .poll(
        async () => {
          return await page.evaluate(async () => {
            const services = window.__yommyServices!;
            const items = await services.queueRepository.listByNovelId(
              "kakuyomu:16817330658027210412",
            );
            return items.length;
          });
        },
        { timeout: 10000, intervals: [200, 500] },
      )
      .toBe(0);
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
          partTitle: null,
          title: `第${i}話 テスト`,
          url: `https://kakuyomu.jp/works/16817330658027210412/episodes/${episodeId}`,
          publishedAt: "2026-01-01T10:00:00Z",
        });
      }

      await services.novelRepository.upsertNovelWithToc(
        {
          ...parsedIndex,
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

    await openNovelDetailMenu(page);
    const clearCacheBtn = page.getByTestId("open-clear-cache-dialog-button");
    await expect(clearCacheBtn).toBeVisible();
    await expect(clearCacheBtn).toBeDisabled();

    const uncachedBadges = page.getByTestId("episode-uncached-badge");
    await expect(uncachedBadges).toHaveCount(4);

    // 3. 一括キャッシュを実行し、全話取得後に容量が表示されボタンが活性化すること (AC-ND-20)
    const batchButton = page.getByTestId("batch-cache-button");
    await batchButton.click();
    await expect(page.getByTestId("batch-cache-progress")).not.toBeVisible({
      timeout: 20000,
    });

    await expect(detailStats).toContainText("全 4 話（取得済み 4 話 / ");
    await expect(detailStats).not.toContainText("0 B）");
    await openNovelDetailMenu(page);
    await expect(batchButton).toHaveText("全話キャッシュ済み");
    await expect(clearCacheBtn).toBeEnabled();
    await page.keyboard.press("Escape");
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

    // 5. 3点メニュー内の「本文キャッシュ整理」ダイアログのキャンセル動作確認
    await openNovelDetailMenu(page);
    await clearCacheBtn.click();
    const clearDialog = page.getByTestId("clear-cache-confirm-dialog");
    await expect(clearDialog).toBeVisible();

    const cancelClearBtn = page.getByTestId("cancel-clear-cache-button");
    await cancelClearBtn.click();
    await expect(clearDialog).not.toBeVisible();

    // 6. 3点メニューから「既読話の本文キャッシュのみ削除」を実行 (AC-ND-21, AC-ND-22, TR-19)
    await openNovelDetailMenu(page);
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

    // 7. 3点メニューから「すべての本文キャッシュを削除」を実行 (AC-ND-21, AC-ND-22, TR-19)
    await openNovelDetailMenu(page);
    await clearCacheBtn.click();
    await expect(clearDialog).toBeVisible();

    const confirmClearAllBtn = page.getByTestId(
      "confirm-clear-all-cache-button",
    );
    await confirmClearAllBtn.click();
    await expect(clearDialog).not.toBeVisible();

    await expect(noticeEl).toContainText("本文キャッシュを削除しました（2話）");
    await expect(detailStats).toContainText("全 4 話（取得済み 0 話 / 0 B）");

    // 全話未取得に戻り、既読状態は保持され、3点メニュー内の削除ボタンが非活性となること
    await expect(readBadges).toHaveCount(2);
    await expect(uncachedBadges).toHaveCount(4);
    // 全話キャッシュ削除後もしおり位置および「続きから読む」ボタンが保持されること (AC-ND-22)
    await expect(resumeButton).toBeVisible();
    await expect(bookmarkBadges).toHaveCount(1);
    await openNovelDetailMenu(page);
    await expect(clearCacheBtn).toBeDisabled();
    await expect(batchButton).toBeEnabled();
    await expect(batchButton).toHaveText("未取得話を一括キャッシュ");

    // 全話キャッシュ削除後、キューが 0 件であることを確認 (R1-03)
    const queueAfterClear = await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const items = await services.queueRepository.listByNovelId(
        "kakuyomu:16817330658027210412",
      );
      return items.length;
    });
    expect(queueAfterClear).toBe(0);

    // 8. 再度全話キャッシュを取得し、設定画面（SCR-05）の動作検証へ進む
    await batchButton.click();
    await expect(page.getByTestId("batch-cache-progress")).not.toBeVisible({
      timeout: 20000,
    });
    await openNovelDetailMenu(page);
    await expect(batchButton).toHaveText("全話キャッシュ済み");
    await page.keyboard.press("Escape");
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
    await openNovelDetailMenu(page);
    await expect(clearCacheBtn).toBeDisabled();
    await expect(page.getByTestId("detail-resume-button")).toBeVisible();
    await expect(page.getByTestId("episode-bookmark-badge")).toHaveCount(1);
  });

  test("一括キャッシュ実行中も作品詳細画面（SCR-02）が非ブロッキングで操作可能であり、未キャッシュ話タップで即座にリーダー画面（SCR-03）へ割り込み読込（high優先度）され中断キューがretryCount=0でpendingへ巻き戻されること (Issue #344, AC-ND-27, AC-ND-29, AC-ND-30, AC-RD-12, AC-RD-35)", async ({
    page,
  }) => {
    await seedKakuyomuNovelAndOpenDetail(page, 8);
    await installChapterLatches(page, {
      heldChapters: [1, 8],
      customBodies: { 7: "第7話の即時割り込み本文" },
    });

    try {
      await openNovelDetailMenu(page);
      const batchButton = page.getByTestId("batch-cache-button");
      await batchButton.click();
      await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

      // low 優先度一括キャッシュが第1話ダウンロード中（HTTP 応答待ち）になるまで待機
      await expect(page.getByTestId("batch-cache-progress")).toBeVisible();
      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return false;
              const queue =
                await services.queueRepository.listByNovelId(novelId);
              const ch1 = queue.find((item) => item.chapterIndex === 1);
              const started =
                (window as LatchWindow).__testCacheLatches?.isStarted(1) ??
                false;
              return ch1?.status === "downloading" && started;
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 15000 },
        )
        .toBe(true);

      // 一括キャッシュ実行中でもヘッダー各ボタンおよび任意エピソード行が非ブロッキングで操作可能であること
      await expect(
        page.getByTestId("detail-favorite-toggle-button"),
      ).toBeEnabled();
      await expect(page.getByTestId("refresh-toc-button")).toBeEnabled();
      await expect(page.getByTestId("novel-detail-menu-button")).toBeEnabled();
      await expect(page.getByTestId("detail-read-first-button")).toBeEnabled();

      const chapter7Button = page.locator('[data-chapter-index="7"]');
      await expect(chapter7Button).toBeVisible();
      await expect(chapter7Button).toBeEnabled();

      // 割り込み直前の resetInterruptedToPending 実行直後に SQLite 上の ch1 行状態を観測する
      await page.evaluate((novelId) => {
        const services = window.__yommyServices!;
        const originalReset =
          services.queueRepository.resetInterruptedToPending.bind(
            services.queueRepository,
          );
        const latchWin = window as LatchWindow;
        latchWin.__rewindSnapshots = [];
        services.queueRepository.resetInterruptedToPending = async (
          targetNovelId: string,
          nowIso?: string,
        ) => {
          await originalReset(targetNovelId, nowIso);
          if (targetNovelId === novelId) {
            const rows = await services.queueRepository.listByNovelId(novelId);
            const ch1 = rows.find((item) => item.chapterIndex === 1);
            if (ch1) {
              latchWin.__rewindSnapshots!.push({
                status: ch1.status,
                retryCount: ch1.retryCount,
              });
            }
          }
        };
      }, SAMPLE_KAKUYOMU_NOVEL_ID);

      // 未取得の第7話をクリックして即座にリーダー画面（SCR-03）へ割り込み遷移（TR-04, high優先度 0msプリエンプション）
      await chapter7Button.click();
      await expect(page).toHaveURL(
        /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/7$/,
      );

      const readerView = page.getByTestId("reader-view");
      await expect(readerView).toBeVisible();
      await expect(readerView).toContainText("第7話の即時割り込み本文");
      await expect(page.getByTestId("reader-error")).not.toBeVisible();

      // 割り込みで中断された第1話の download_queue 行が retryCount=0 のまま pending へ巻き戻され、low が preempted 状態であること
      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return null;
              const queue =
                await services.queueRepository.listByNovelId(novelId);
              const ch1 = queue.find((item) => item.chapterIndex === 1);
              const progress =
                services.cacheScheduler?.getNovelProgress(novelId) ?? null;
              const rewinds = (window as LatchWindow).__rewindSnapshots ?? [];
              return {
                rewoundToPending: rewinds.some(
                  (snap) => snap.status === "pending" && snap.retryCount === 0,
                ),
                ch1RetryCount: ch1?.retryCount ?? null,
                batchStatus: progress?.status ?? null,
              };
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 10000 },
        )
        .toEqual({
          rewoundToPending: true,
          ch1RetryCount: 0,
          batchStatus: "preempted",
        });
    } finally {
      if (!page.isClosed()) {
        await releaseChapterLatches(page, [1, 8]);
      }
    }
  });

  test("リーダー（SCR-03）で5話先読み（medium優先度）完了後に作品詳細（SCR-02）へ復帰（TR-06）すると、中断していた一括キャッシュ（low優先度）がユーザー操作なしで自動再開・完了すること (Issue #344, AC-ND-12, AC-ND-13, AC-ND-29, AC-ND-30, AC-RD-12, AC-RD-35, TR-06)", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await seedKakuyomuNovelAndOpenDetail(page, 8);
    await installChapterLatches(page, {
      holdFirstCallChapters: [1],
      heldChapters: [7],
      customBodies: { 1: "第1話の即時割り込み本文" },
    });

    try {
      await openNovelDetailMenu(page);
      const batchButton = page.getByTestId("batch-cache-button");
      await batchButton.click();
      await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return false;
              const queue =
                await services.queueRepository.listByNovelId(novelId);
              const ch1 = queue.find((item) => item.chapterIndex === 1);
              const started =
                (window as LatchWindow).__testCacheLatches?.isStarted(1) ??
                false;
              return ch1?.status === "downloading" && started;
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 15000 },
        )
        .toBe(true);

      // 「第1話から読む」ボタンで SCR-03（第1話）へ遷移（high 割り込み）
      await page.getByTestId("detail-read-first-button").click();
      await expect(page).toHaveURL(
        /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1$/,
      );
      const readerView = page.getByTestId("reader-view");
      await expect(readerView).toBeVisible();
      await expect(readerView).toContainText("第1話の即時割り込み本文");

      // SCR-03 滞在中に medium 優先度の5話先読み（第2〜6話）が完了し、download_queue に残り第7・8話のみが残るまで待機
      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return null;
              const chapters =
                await services.chapterRepository.listChaptersByNovelId(novelId);
              const cachedSummaryIndexes = chapters
                .filter((c) => c.downloadedAt !== null && c.byteSize > 0)
                .map((c) => c.chapterIndex)
                .sort((a, b) => a - b);
              const loadedChapters = await Promise.all(
                [1, 2, 3, 4, 5, 6].map((idx) =>
                  services.chapterRepository.getChapter(novelId, idx),
                ),
              );
              const cachedIndexes = loadedChapters
                .filter((ch): ch is NonNullable<typeof ch> =>
                  Boolean(ch && ch.bodyHtml && ch.bodyHtml.length > 0),
                )
                .map((ch) => ch.chapterIndex)
                .sort((a, b) => a - b);
              const queue =
                await services.queueRepository.listByNovelId(novelId);
              const queueIndexes = queue
                .map((q) => q.chapterIndex)
                .sort((a, b) => a - b);
              const isBatchActive =
                services.cacheScheduler?.isNovelBatchCaching(novelId) ?? false;
              return {
                cachedSummaryIndexes,
                cachedIndexes,
                queueIndexes,
                isBatchActive,
              };
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 25000 },
        )
        .toEqual({
          cachedSummaryIndexes: [1, 2, 3, 4, 5, 6],
          cachedIndexes: [1, 2, 3, 4, 5, 6],
          queueIndexes: [7, 8],
          isBatchActive: true,
        });

      // 上部オーバーレイの「← 目次」で SCR-02 へ復帰 (TR-06)
      await page.getByTestId("reader-bottom-touch-zone").click();
      await expect(page.getByTestId("reader-top-back-to-toc")).toBeVisible();
      await page.getByTestId("reader-top-back-to-toc").click();
      await expect(page).toHaveURL(
        /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
      );
      await expect(page.getByTestId("novel-detail-page")).toBeVisible();

      // ユーザー操作なしで low 一括キャッシュ進捗表示が自動維持・再開されており、6話取得済みが反映されていること
      const detailStats = page.getByTestId("novel-detail-stats");
      await expect(detailStats).toContainText("全 8 話（取得済み 6 話");
      const progressEl = page.getByTestId("batch-cache-progress");
      await expect(progressEl).toBeVisible();

      // 再開された一括キャッシュにより download_queue 内に status === "downloading" の行が存在すること
      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return false;
              const queue =
                await services.queueRepository.listByNovelId(novelId);
              return queue.some((item) => item.status === "downloading");
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 10000 },
        )
        .toBe(true);

      // 第7話ラッチを解放すると残りの第7・8話が自動完了し、キューが空になること
      await releaseChapterLatches(page, [7]);
      await expect(progressEl).not.toBeVisible({ timeout: 20000 });
      await expect(detailStats).toContainText("全 8 話（取得済み 8 話");

      await openNovelDetailMenu(page);
      await expect(batchButton).toHaveText("全話キャッシュ済み");
      await expect(batchButton).toBeDisabled();

      const remainingQueueCount = await page.evaluate(async (novelId) => {
        const services = window.__yommyServices!;
        const queue = await services.queueRepository.listByNovelId(novelId);
        return queue.length;
      }, SAMPLE_KAKUYOMU_NOVEL_ID);
      expect(remainingQueueCount).toBe(0);
    } finally {
      if (!page.isClosed()) {
        await releaseChapterLatches(page, [1, 7]);
      }
    }
  });

  test("一括キャッシュ実行中に設定画面（SCR-05）から『すべての本文キャッシュを削除』を実行すると AbortSignal による即時中断と完了待ち（cancelAllTasks / cancelNovelTasks）が行われ、削除後の DB・キュー整合性が維持されること (Issue #344, AC-ST-15, AC-ST-16, TR-20)", async ({
    page,
  }) => {
    await seedKakuyomuNovelAndOpenDetail(page, 4);
    await installChapterLatches(page, {
      heldChapters: [2],
      customBodies: { 2: "中断・破棄される第2話本文" },
    });

    try {
      await openNovelDetailMenu(page);
      const batchButton = page.getByTestId("batch-cache-button");
      await batchButton.click();
      await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

      // 第1話キャッシュ完了後、第2話が HTTP 応答待ち（downloading）になるまで待機
      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return false;
              const ch1 = await services.chapterRepository.getChapter(
                novelId,
                1,
              );
              const queue =
                await services.queueRepository.listByNovelId(novelId);
              const ch2 = queue.find((item) => item.chapterIndex === 2);
              const started =
                (window as LatchWindow).__testCacheLatches?.isStarted(2) ??
                false;
              return (
                ch1 !== null &&
                ch1.bodyHtml !== null &&
                ch2?.status === "downloading" &&
                started
              );
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 15000 },
        )
        .toBe(true);

      // 設定画面（SCR-05）へ遷移し、すべての本文キャッシュを削除（TR-20）
      await page.getByTestId("tab-settings").click();
      await expect(page).toHaveURL("/settings");
      await expect(page.getByTestId("settings-page")).toBeVisible();

      const storageCacheSummary = page.getByTestId("storage-cache-summary");
      await expect(storageCacheSummary).toContainText(
        "キャッシュ済み: 全 1 話",
      );
      const openGlobalClearBtn = page.getByTestId(
        "open-global-clear-cache-dialog-button",
      );
      await expect(openGlobalClearBtn).toBeEnabled();
      await openGlobalClearBtn.click();

      const globalDialog = page.getByTestId("global-clear-cache-dialog");
      await expect(globalDialog).toBeVisible();
      await page.getByTestId("confirm-global-clear-all-cache-button").click();
      await expect(globalDialog).not.toBeVisible();

      await expect(page.getByTestId("storage-cache-notice")).toContainText(
        "本文キャッシュを一括削除しました（1話）",
      );
      await expect(storageCacheSummary).toContainText(
        "キャッシュ済み: 全 0 話（合計 0 B）",
      );
      await expect(openGlobalClearBtn).toBeDisabled();

      // cancelAllTasks 内で AbortSignal による即時中断と完了待ちが実施済みのため、モック側の待機 Promise クリーンアップとして第2話ラッチを解放したうえで削除後の DB・キュー整合性を検証
      await releaseChapterLatches(page, [2]);
      await page.evaluate(async () => {
        await Promise.resolve();
        await new Promise<void>((resolve) => {
          queueMicrotask(resolve);
        });
      });

      const postClearIntegrity = await page.evaluate(async (novelId) => {
        const services = window.__yommyServices!;
        const summary =
          await services.chapterRepository.getStorageCacheSummary();
        const chapterSummaries =
          await services.chapterRepository.listChaptersByNovelId(novelId);
        const chapterRecords = await Promise.all(
          chapterSummaries.map((ch) =>
            services.chapterRepository.getChapter(novelId, ch.chapterIndex),
          ),
        );
        const queue = await services.queueRepository.listByNovelId(novelId);
        return {
          totalCachedChapters: summary.totalCachedChapters,
          totalByteSize: summary.totalByteSize,
          anyChapterHasBody:
            chapterSummaries.some(
              (ch) => ch.downloadedAt !== null || ch.byteSize !== 0,
            ) || chapterRecords.some((ch) => ch?.bodyHtml !== null),
          queueLength: queue.length,
          isBatchCaching:
            services.cacheScheduler?.isNovelBatchCaching(novelId) ?? null,
          batchStatus:
            services.cacheScheduler?.getNovelProgress(novelId)?.status ?? null,
        };
      }, SAMPLE_KAKUYOMU_NOVEL_ID);

      expect(postClearIntegrity).toEqual({
        totalCachedChapters: 0,
        totalByteSize: 0,
        anyChapterHasBody: false,
        queueLength: 0,
        isBatchCaching: false,
        batchStatus: "cancelled",
      });

      // 本棚経由で SCR-02 へ戻り、キャッシュ 0 話・全話未取得バッジ・再実行可能メニューであることを確認
      await page.getByTestId("tab-bookshelf").click();
      await expect(page).toHaveURL("/");
      await page.getByTestId("novel-card-select").click();
      await expect(page.getByTestId("novel-detail-page")).toBeVisible();
      await expect(page.getByTestId("novel-detail-stats")).toContainText(
        "全 4 話（取得済み 0 話 / 0 B）",
      );
      await expect(page.getByTestId("episode-uncached-badge")).toHaveCount(4);
      await expect(page.getByTestId("batch-cache-progress")).not.toBeVisible();

      await openNovelDetailMenu(page);
      await expect(batchButton).toHaveText("未取得話を一括キャッシュ");
      await expect(batchButton).toBeEnabled();
    } finally {
      if (!page.isClosed()) {
        await releaseChapterLatches(page, [2]);
      }
    }
  });

  test("一括キャッシュ実行中に設定画面（SCR-05）から『既読話の本文キャッシュのみ削除（onlyRead: true）』を実行すると既読キャッシュのみ破棄され未取得キューが保持され、SCR-02 復帰後に再開ボタンから完了まで再開できること (Issue #367, R1-04, R1-18, TR-19, AC-ST-16)", async ({
    page,
  }) => {
    await seedKakuyomuNovelAndOpenDetail(page, 4);
    await installChapterLatches(page, { heldChapters: [2] });

    try {
      // 1. 第1話をリーダーで開いてキャッシュ済み＋既読（isRead: true）にする（第2話はラッチで先読みブロック）
      await page.getByTestId("detail-read-first-button").click();
      await expect(page.getByTestId("reader-view")).toBeVisible();
      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return false;
              const chapters =
                await services.chapterRepository.listChaptersByNovelId(novelId);
              const ch1Summary = chapters.find((c) => c.chapterIndex === 1);
              const ch1 = await services.chapterRepository.getChapter(
                novelId,
                1,
              );
              return Boolean(
                ch1Summary?.isRead &&
                ch1?.downloadedAt !== null &&
                ch1?.bodyHtml,
              );
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 10000 },
        )
        .toBe(true);

      // SCR-02 へ戻り、reader 側の medium 先読みが停止した状態で第2話ラッチを再初期化
      await page.getByTestId("reader-bottom-touch-zone").click();
      await expect(page.getByTestId("reader-top-back-to-toc")).toBeVisible();
      await page.getByTestId("reader-top-back-to-toc").click();
      await expect(page.getByTestId("novel-detail-page")).toBeVisible();
      await expect(page.getByTestId("novel-detail-stats")).toContainText(
        "全 4 話（取得済み 1 話",
      );

      await releaseChapterLatches(page, [2]);
      await installChapterLatches(page, { heldChapters: [2] });

      // 2. 一括キャッシュを開始し、第2話が downloading で第2話ラッチ到達・第3〜4話が pending の状態を作る
      await openNovelDetailMenu(page);
      const batchButton = page.getByTestId("batch-cache-button");
      await batchButton.click();
      await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return false;
              const queue =
                await services.queueRepository.listByNovelId(novelId);
              const ch2 = queue.find((item) => item.chapterIndex === 2);
              const ch3 = queue.find((item) => item.chapterIndex === 3);
              const ch4 = queue.find((item) => item.chapterIndex === 4);
              const started =
                (window as LatchWindow).__testCacheLatches?.isStarted(2) ??
                false;
              return (
                ch2?.status === "downloading" &&
                ch3?.status === "pending" &&
                ch4?.status === "pending" &&
                started &&
                Boolean(services.cacheScheduler?.isNovelBatchCaching(novelId))
              );
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 15000 },
        )
        .toBe(true);

      // 3. SCR-05 設定画面へ移動し、「既読話の本文キャッシュのみ削除」を実行（TR-19, AC-ST-16）
      await page.getByTestId("tab-settings").click();
      await expect(page).toHaveURL("/settings");
      await expect(page.getByTestId("settings-page")).toBeVisible();

      const storageCacheSummary = page.getByTestId("storage-cache-summary");
      await expect(storageCacheSummary).toContainText(
        "キャッシュ済み: 全 1 話",
      );
      await page.getByTestId("open-global-clear-cache-dialog-button").click();
      const globalDialog = page.getByTestId("global-clear-cache-dialog");
      await expect(globalDialog).toBeVisible();
      await page.getByTestId("confirm-global-clear-read-cache-button").click();
      await expect(globalDialog).not.toBeVisible();

      await expect(page.getByTestId("storage-cache-notice")).toContainText(
        "本文キャッシュを一括削除しました（1話）",
      );
      await expect(storageCacheSummary).toContainText(
        "キャッシュ済み: 全 0 話（合計 0 B）",
      );

      // モック側ラッチを解放（cleanup）
      await releaseChapterLatches(page, [2]);

      // 4. 第1話の本文のみ削除され（既読フラグは維持）、未取得キュー（第2〜4話）が 'pending' のまま保持されていること
      const afterReadClearState = await page.evaluate(async (novelId) => {
        const services = window.__yommyServices!;
        const summaries =
          await services.chapterRepository.listChaptersByNovelId(novelId);
        const ch1Summary = summaries.find((c) => c.chapterIndex === 1);
        const ch1 = await services.chapterRepository.getChapter(novelId, 1);
        const queue = await services.queueRepository.listByNovelId(novelId);
        return {
          ch1IsRead: ch1Summary?.isRead ?? false,
          ch1DownloadedAt: ch1 ? ch1.downloadedAt : "missing",
          ch1BodyHtml: ch1 ? ch1.bodyHtml : "missing",
          queueStatuses: queue
            .slice()
            .sort((a, b) => a.chapterIndex - b.chapterIndex)
            .map((q) => ({ chapterIndex: q.chapterIndex, status: q.status })),
          isBatchCaching:
            services.cacheScheduler?.isNovelBatchCaching(novelId) ?? null,
        };
      }, SAMPLE_KAKUYOMU_NOVEL_ID);

      expect(afterReadClearState).toEqual({
        ch1IsRead: true,
        ch1DownloadedAt: null,
        ch1BodyHtml: null,
        queueStatuses: [
          { chapterIndex: 2, status: "pending" },
          { chapterIndex: 3, status: "pending" },
          { chapterIndex: 4, status: "pending" },
        ],
        isBatchCaching: false,
      });

      // 5. 本棚経由で SCR-02 へ復帰し、再開ボタン（「キャッシュを再開（残り3話）」）から完了まで再開できること
      await page.getByTestId("tab-bookshelf").click();
      await expect(page).toHaveURL("/");
      await page.getByTestId("novel-card-select").click();
      await expect(page.getByTestId("novel-detail-page")).toBeVisible();
      await expect(page.getByTestId("novel-detail-stats")).toContainText(
        "全 4 話（取得済み 0 話",
      );

      await openNovelDetailMenu(page);
      await expect(batchButton).toContainText("キャッシュを再開（残り3話）");
      await batchButton.click();
      await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

      await expect(page.getByTestId("batch-cache-progress")).not.toBeVisible({
        timeout: 20000,
      });
      await expect(page.getByTestId("novel-detail-stats")).toContainText(
        "全 4 話（取得済み 4 話",
      );

      const finalQueueCount = await page.evaluate(async (novelId) => {
        const services = window.__yommyServices!;
        const queue = await services.queueRepository.listByNovelId(novelId);
        return queue.length;
      }, SAMPLE_KAKUYOMU_NOVEL_ID);
      expect(finalQueueCount).toBe(0);
    } finally {
      if (!page.isClosed()) {
        await releaseChapterLatches(page, [2]);
      }
    }
  });

  test("一括キャッシュ実行中に『目次を更新』ボタン（refresh-toc-button）を押下すると進行中バッチを一時停止して目次差分を取り込み、追加話を含めて一括キャッシュが自動再開・完了すること (Issue #367, R1-04, AC-ND-29)", async ({
    page,
  }) => {
    await seedKakuyomuNovelAndOpenDetail(page, 4);
    await installChapterLatches(page, { heldChapters: [2] });

    try {
      // 既存の4話構成に第5話を追加した更新後目次 HTML をモック設定
      await page.evaluate(
        async ({ workUrl, novelId }) => {
          const services = window.__yommyServices!;
          const chapters =
            await services.chapterRepository.listChaptersByNovelId(novelId);
          const episodeBlocks = [
            ...chapters.map(
              (ch) => `<div class="widget-toc-episode">
              <a href="/works/16817330658027210412/episodes/${ch.remoteChapterId}">
                <span>${ch.title}</span>
              </a>
              <time datetime="2026-01-01T10:00:00Z">2026年1月1日 10:00</time>
            </div>`,
            ),
            `<div class="widget-toc-episode">
              <a href="/works/16817330658027210412/episodes/16817330658027210499">
                <span>第5話 追加エピソード</span>
              </a>
              <time datetime="2026-01-05T10:00:00Z">2026年1月5日 10:00</time>
            </div>`,
          ].join("\n");

          const updatedWorkHtml = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>境界迷宮と異界の魔術師 - カクヨム</title>
    <link rel="canonical" href="${workUrl}" />
  </head>
  <body>
    <header id="workHeader">
      <h1 id="workTitle"><a href="/works/16817330658027210412">境界迷宮と異界の魔術師</a></h1>
      <h2 id="workAuthor-activityName"><a href="/users/onozaki">小野崎</a></h2>
    </header>
    <div id="introduction">異世界に召喚された少年の冒険譚。</div>
    <div class="widget-toc-main">
      <div class="widget-toc-items">
        ${episodeBlocks}
      </div>
    </div>
  </body>
</html>`;

          const client = services.httpClient as unknown as MockHttpClientHandle;
          client.setResponse(workUrl, {
            status: 200,
            url: workUrl,
            headers: {},
            html: updatedWorkHtml,
          });
        },
        {
          workUrl: SAMPLE_KAKUYOMU_WORK_URL,
          novelId: SAMPLE_KAKUYOMU_NOVEL_ID,
        },
      );

      // 1. 一括キャッシュを開始し、第1話完了・第2話ラッチ待機（downloading）になるまで待機
      await openNovelDetailMenu(page);
      const batchButton = page.getByTestId("batch-cache-button");
      await batchButton.click();
      await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return false;
              const ch1 = await services.chapterRepository.getChapter(
                novelId,
                1,
              );
              const queue =
                await services.queueRepository.listByNovelId(novelId);
              const ch2 = queue.find((item) => item.chapterIndex === 2);
              const started =
                (window as LatchWindow).__testCacheLatches?.isStarted(2) ??
                false;
              return (
                ch1 !== null &&
                ch1.bodyHtml !== null &&
                ch2?.status === "downloading" &&
                started
              );
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 15000 },
        )
        .toBe(true);

      // 2. 一括キャッシュ進行中に『目次を更新』ボタンを押下
      await page.getByTestId("refresh-toc-button").click();

      // 3. 目次差分（+1話）が反映され、一時停止したバッチが追加話（第5話）を含めて自動再開すること
      await expect(page.getByTestId("novel-detail-notice")).toContainText(
        "目次を更新しました（+1話）",
      );
      await expect(page.getByTestId("novel-detail-stats")).toContainText(
        "全 5 話",
      );
      await expect(page.getByTestId("novel-detail-page")).toContainText(
        "第5話 追加エピソード",
      );
      await expect(page.getByTestId("batch-cache-progress")).toBeVisible();

      // 4. 第2話ラッチを解放すると、追加された第5話を含む全5話が完了すること
      await releaseChapterLatches(page, [2]);

      await expect(page.getByTestId("batch-cache-progress")).not.toBeVisible({
        timeout: 20000,
      });
      await expect(page.getByTestId("novel-detail-stats")).toContainText(
        "全 5 話（取得済み 5 話",
      );

      const finalState = await page.evaluate(async (novelId) => {
        const services = window.__yommyServices!;
        const queue = await services.queueRepository.listByNovelId(novelId);
        const ch5 = await services.chapterRepository.getChapter(novelId, 5);
        return {
          queueLength: queue.length,
          ch5Cached: Boolean(ch5?.downloadedAt && ch5.bodyHtml),
          isBatchCaching:
            services.cacheScheduler?.isNovelBatchCaching(novelId) ?? null,
        };
      }, SAMPLE_KAKUYOMU_NOVEL_ID);

      expect(finalState).toEqual({
        queueLength: 0,
        ch5Cached: true,
        isBatchCaching: false,
      });
    } finally {
      if (!page.isClosed()) {
        await releaseChapterLatches(page, [2]);
      }
    }
  });

  test("一括キャッシュ実行中に一部話の取得が失敗した場合、完了を待たずに進捗バー（batch-cache-progress）へリアルタイムに『[失敗 1話]』が表示され、完了後に再試行導線へ遷移すること (Issue #367, R1-04, AC-ND-25)", async ({
    page,
  }) => {
    await seedKakuyomuNovelAndOpenDetail(page, 4);
    await installChapterLatches(page, { heldChapters: [3] });

    try {
      // 第2話のみ HTTP 500 失敗を返し、第3話はラッチで保留した状態を構成
      await page.evaluate(async (novelId) => {
        const services = window.__yommyServices!;
        const chapters =
          await services.chapterRepository.listChaptersByNovelId(novelId);
        const ch2 = chapters.find((c) => c.chapterIndex === 2);
        if (!ch2) {
          throw new Error("Chapter 2 not found");
        }
        const client = services.httpClient as unknown as MockHttpClientHandle;
        client.setResponse(ch2.url, {
          status: 500,
          url: ch2.url,
          headers: {},
          html: "Server Error",
        });
      }, SAMPLE_KAKUYOMU_NOVEL_ID);

      // 1. 一括キャッシュを開始
      await openNovelDetailMenu(page);
      const batchButton = page.getByTestId("batch-cache-button");
      await batchButton.click();
      await expect(page.getByTestId("novel-detail-menu")).not.toBeVisible();

      // 2. 第3話ラッチ保留中で一括キャッシュ完了前の段階でも batch-cache-progress に『[失敗 1話]』がリアルタイム表示されること
      await expect
        .poll(
          async () => {
            return await page.evaluate(async (novelId) => {
              const services = window.__yommyServices;
              if (!services) return null;
              const started3 =
                (window as LatchWindow).__testCacheLatches?.isStarted(3) ??
                false;
              const isBatchActive =
                services.cacheScheduler?.isNovelBatchCaching(novelId) ?? false;
              return { started3, isBatchActive };
            }, SAMPLE_KAKUYOMU_NOVEL_ID);
          },
          { timeout: 15000 },
        )
        .toEqual({
          started3: true,
          isBatchActive: true,
        });

      const progressEl = page.getByTestId("batch-cache-progress");
      await expect(progressEl).toBeVisible();
      await expect(progressEl).toContainText("[失敗 1話]");

      // 3. 第3話ラッチを解放してバッチ完了させ、通知および再試行ボタンが表示されること
      await releaseChapterLatches(page, [3]);

      await expect(progressEl).not.toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId("novel-detail-error")).toContainText(
        "1話の取得に失敗しました（再試行可能）",
      );

      await openNovelDetailMenu(page);
      await expect(batchButton).toHaveText("失敗した話を再試行（1話）");
    } finally {
      if (!page.isClosed()) {
        await releaseChapterLatches(page, [3]);
      }
    }
  });
});
