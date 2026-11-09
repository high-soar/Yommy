import { test, expect, type Page } from "@playwright/test";

/**
 * OS バックキー押下イベントをシミュレートするヘルパー
 */
async function triggerBackButton(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const bridge =
      (
        window as unknown as {
          __yommyAppBridge?: { triggerBackButton: () => Promise<void> };
        }
      ).__yommyAppBridge ||
      (
        window as unknown as {
          __yommyServices?: {
            appBridge: { triggerBackButton: () => Promise<void> };
          };
        }
      ).__yommyServices?.appBridge;
    if (bridge) {
      await bridge.triggerBackButton();
    }
  });
}

test.describe("SCN-07: 内蔵ブラウザ画面（SCR-04）による目次・本文DOMインポート・フォールバック・論理階層復帰シナリオ (SYS-REQ-13, SYS-REQ-14, TR-09〜12, SCN-07-01〜03)", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() =>
      Boolean(
        (window as unknown as { __yommyServices?: { isReady?: boolean } })
          .__yommyServices?.isReady,
      ),
    );
  });

  test("SCN-07-01: 作品詳細（SCR-02）→「内蔵ブラウザで開く」（TR-09）→ SCR-04 で目次 DOM インポート → SCR-02 へ自動遷移（TR-11）し、目次・作品情報が更新反映される E2E 検証", async ({
    page,
  }) => {
    const sampleWorkUrl = "https://kakuyomu.jp/works/1177354054881162325";
    const novelId = "kakuyomu:1177354054881162325";

    // 1. 初期状態として作品（全1話・旧版タイトル）をローカル DB に登録
    await page.evaluate(
      async ({ sampleWorkUrl }) => {
        const services = window.__yommyServices!;
        const initialIndex = {
          siteType: "kakuyomu" as const,
          remoteWorkId: "1177354054881162325",
          canonicalUrl: sampleWorkUrl,
          title: "境界迷宮と異界の魔術師（旧版）",
          author: "小野崎",
          synopsis: "異世界に召喚された少年の冒険譚。",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "1177354054881162326",
              partTitle: null,
              title: "プロローグ：目覚め",
              url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326",
              publishedAt: null,
            },
          ],
          nextTocPageUrl: null,
        };
        await services.novelRepository.upsertNovelWithToc(
          initialIndex,
          new Date().toISOString(),
        );
      },
      { sampleWorkUrl, novelId },
    );

    // 本棚をリロードして登録作品を表示
    await page.reload();
    await page.waitForFunction(() =>
      Boolean(
        (window as unknown as { __yommyServices?: { isReady?: boolean } })
          .__yommyServices?.isReady,
      ),
    );

    // 2. 本棚から作品詳細画面 (SCR-02) へ遷移
    const novelCard = page.getByTestId("novel-card-select");
    await expect(novelCard).toBeVisible();
    await novelCard.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325$/,
    );
    const novelDetailPage = page.getByTestId("novel-detail-page");
    await expect(novelDetailPage).toBeVisible();

    // 初期状態の確認（旧タイトル・全1話）
    await expect(page.getByTestId("novel-detail-title")).toHaveText(
      "境界迷宮と異界の魔術師（旧版）",
    );
    await expect(page.getByTestId("novel-detail-stats")).toContainText(
      "全 1 話",
    );
    await expect(page.getByTestId("episode-item")).toHaveCount(1);

    // 3. 作品詳細ヘッダーの「内蔵ブラウザで開く」ボタンを押下 (TR-09)
    const openWebviewBtn = page.getByTestId("open-webview-button");
    await expect(openWebviewBtn).toBeVisible();
    await openWebviewBtn.click();

    // 4. 内蔵ブラウザ画面 (SCR-04) への遷移確認
    await expect(page).toHaveURL(
      new RegExp(
        `/browser\\?url=${encodeURIComponent(sampleWorkUrl)}&novelId=${encodeURIComponent(novelId)}`,
      ),
    );
    const webviewImportPage = page.getByTestId("webview-import-page");
    await expect(webviewImportPage).toBeVisible();

    const urlInput = page.getByTestId("browser-url-input");
    await expect(urlInput).toHaveValue(sampleWorkUrl);

    // 5. MockWebViewDomBridge に更新された目次 DOM（新版タイトル・新エピソード追加）を設定
    const updatedHtml = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>境界迷宮と異界の魔術師（新版） - カクヨム</title>
    <link rel="canonical" href="${sampleWorkUrl}" />
  </head>
  <body>
    <div id="container">
      <header id="workHeader">
        <h1 id="workTitle"><a href="/works/1177354054881162325">境界迷宮と異界の魔術師（新版）</a></h1>
        <h2 id="workAuthor-activityName"><a href="/users/onozaki">小野崎</a></h2>
      </header>
      <div id="introduction">新展開の冒険譚。</div>
      <div class="widget-toc-main">
        <div class="widget-toc-items">
          <div class="widget-toc-episode">
            <a href="/works/1177354054881162325/episodes/1177354054881162326">
              <span>プロローグ：目覚め</span>
            </a>
          </div>
          <div class="widget-toc-episode">
            <a href="/works/1177354054881162325/episodes/1177354054881162327">
              <span>第1話 見知らぬ空（新エピソード）</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;

    await page.evaluate(
      ({ sampleWorkUrl, updatedHtml }) => {
        window.__yommyServices?.webViewDomBridge.setMockPage({
          url: sampleWorkUrl,
          title: "境界迷宮と異界の魔術師（新版） - カクヨム",
          html: updatedHtml,
        });
      },
      { sampleWorkUrl, updatedHtml },
    );

    // 6. 「表示中ページを取り込む」ボタンを押下して目次 DOM インポートを実行
    const importBtn = page.getByTestId("import-dom-button");
    await expect(importBtn).toBeVisible();
    await expect(importBtn).toBeEnabled();
    await importBtn.click();

    // 7. インポート完了後、作品詳細画面 (SCR-02) へ自動遷移 (TR-11)
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325$/,
    );
    await expect(novelDetailPage).toBeVisible();

    // 8. 作品詳細画面上で更新された作品タイトル・全2話・新エピソードが反映されていることを確認
    await expect(page.getByTestId("novel-detail-title")).toHaveText(
      "境界迷宮と異界の魔術師（新版）",
    );
    await expect(page.getByTestId("novel-detail-stats")).toContainText(
      "全 2 話",
    );
    await expect(page.getByTestId("episode-item")).toHaveCount(2);
    await expect(page.getByTestId("episode-item").nth(1)).toContainText(
      "第1話 見知らぬ空（新エピソード）",
    );

    // 9. SQLite DB にも新タイトルおよび全2話が永続化されていることを確認
    const persistedNovel = await page.evaluate(
      async ({ novelId }) => {
        const services = window.__yommyServices!;
        const novel = await services.novelRepository.getNovelById(novelId);
        const chapters =
          await services.chapterRepository.listChaptersByNovelId(novelId);
        return {
          title: novel?.title,
          chapterCount: chapters.length,
          secondChapterTitle: chapters[1]?.title,
        };
      },
      { novelId },
    );

    expect(persistedNovel.title).toBe("境界迷宮と異界の魔術師（新版）");
    expect(persistedNovel.chapterCount).toBe(2);
    expect(persistedNovel.secondChapterTitle).toBe(
      "第1話 見知らぬ空（新エピソード）",
    );
  });

  test("SCN-07-02: 小説リーダー（SCR-03）で未キャッシュ話の通信エラー発生 → エラー画面の「内蔵ブラウザで開いて取り込む」（TR-10）→ SCR-04 で本文 DOM インポート → SCR-03 へ直接遷移（TR-11）し、縦書き本文・ルビが描画されて読書再開できる E2E 検証", async ({
    page,
  }) => {
    const sampleWorkUrl = "https://kakuyomu.jp/works/1177354054881162325";
    const episodeUrl =
      "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326";
    const novelId = "kakuyomu:1177354054881162325";

    // 1. 作品情報をローカル DB に登録（本文は未キャッシュ状態）
    await page.evaluate(
      async ({ sampleWorkUrl, episodeUrl }) => {
        const services = window.__yommyServices!;
        const initialIndex = {
          siteType: "kakuyomu" as const,
          remoteWorkId: "1177354054881162325",
          canonicalUrl: sampleWorkUrl,
          title: "境界迷宮と異界の魔術師",
          author: "小野崎",
          synopsis: "異世界に召喚された少年の冒険譚。",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "1177354054881162326",
              partTitle: null,
              title: "プロローグ：目覚め",
              url: episodeUrl,
              publishedAt: null,
            },
          ],
          nextTocPageUrl: null,
        };
        await services.novelRepository.upsertNovelWithToc(
          initialIndex,
          new Date().toISOString(),
        );
      },
      { sampleWorkUrl, episodeUrl, novelId },
    );

    // 本棚をリロードして登録作品を同期
    await page.reload();
    await page.waitForFunction(() =>
      Boolean(
        (window as unknown as { __yommyServices?: { isReady?: boolean } })
          .__yommyServices?.isReady,
      ),
    );

    // リロード後の MockHttpClient でエピソード取得時に Cloudflare/Bot 対策エラー (HTTP 403) をシミュレート
    await page.evaluate(
      ({ episodeUrl }) => {
        const services = window.__yommyServices!;
        services.httpClient.setResponse(episodeUrl, {
          status: 403,
          headers: {},
          html: "<html><head><title>Just a moment...</title></head><body>Cloudflare turnstile block</body></html>",
          url: episodeUrl,
        });
      },
      { episodeUrl },
    );

    // 2. 本棚から作品詳細 (SCR-02) を経由して第1話リーダー (SCR-03) を開く
    const novelCard = page.getByTestId("novel-card-select");
    await expect(novelCard).toBeVisible();
    await novelCard.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325$/,
    );
    const readFirstBtn = page.getByTestId("detail-read-first-button");
    await expect(readFirstBtn).toBeVisible();
    await readFirstBtn.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325\/chapters\/1$/,
    );

    // 3. 通信エラー発生によりエラーアラート (reader-error) および「内蔵ブラウザで開いて取り込む」ボタンが表示されることを確認
    const readerError = page.getByTestId("reader-error");
    await expect(readerError).toBeVisible({ timeout: 10000 });
    await expect(readerError).toContainText(
      "エピソードの取得に失敗しました (HTTP 403)",
    );

    const readerOpenWebviewBtn = page.getByTestId("reader-open-webview-button");
    await expect(readerOpenWebviewBtn).toBeVisible();
    await expect(readerOpenWebviewBtn).toHaveText(
      "内蔵ブラウザで開いて取り込む",
    );

    // 4. 「内蔵ブラウザで開いて取り込む」ボタンを押下 (TR-10)
    await readerOpenWebviewBtn.click();

    // 5. 内蔵ブラウザ画面 (SCR-04) へのフォールバック遷移を確認
    await expect(page).toHaveURL(
      new RegExp(
        `/browser\\?url=${encodeURIComponent(episodeUrl)}&novelId=${encodeURIComponent(novelId)}&chapterIndex=1`,
      ),
    );
    const webviewImportPage = page.getByTestId("webview-import-page");
    await expect(webviewImportPage).toBeVisible();

    // 6. MockWebViewDomBridge に認証突破後の本文 DOM（ルビ・傍点を含む HTML）を設定
    const episodeHtml = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>プロローグ：目覚め - カクヨム</title>
  </head>
  <body>
    <div id="contentMain">
      <header class="widget-episode-header">
        <h1 class="widget-episodeTitle">プロローグ：目覚め</h1>
      </header>
      <div class="widget-episodeBody js-episode-body">
        <p>二つの<ruby><rb>太陽</rb><rp>(</rp><rt>たいよう</rt><rp>)</rp></ruby>が昇る世界。</p>
        <p class="blank"><br /></p>
        <p>少年は静かに<em class="bouten">覚醒</em>した。</p>
      </div>
    </div>
  </body>
</html>`;

    await page.evaluate(
      ({ episodeUrl, episodeHtml }) => {
        window.__yommyServices?.webViewDomBridge.setMockPage({
          url: episodeUrl,
          title: "プロローグ：目覚め - カクヨム",
          html: episodeHtml,
        });
      },
      { episodeUrl, episodeHtml },
    );

    // 7. 「表示中ページを取り込む」ボタンを押下して本文 DOM インポートを実行
    const importBtn = page.getByTestId("import-dom-button");
    await expect(importBtn).toBeVisible();
    await expect(importBtn).toBeEnabled();
    await importBtn.click();

    // 8. インポート完了後、リーダー画面 (SCR-03) へ直接遷移 (TR-11)
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325\/chapters\/1$/,
    );

    // 9. リーダー画面でエラーが解消され、縦書き本文・ルビ・傍点が正常に描画されて読書が再開できることを確認
    await expect(page.getByTestId("reader-error")).not.toBeVisible();
    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();

    // 縦書きモード確認
    await expect(readerView).toHaveAttribute(
      "data-writing-mode",
      "vertical-rl",
    );

    // 本文内のルビ (<ruby> / <rt>) および傍点 (<em class="bouten">) の描画確認
    const rubyElement = readerView.locator("ruby");
    await expect(rubyElement.first()).toBeVisible();
    await expect(rubyElement.first().locator("rt")).toHaveText("たいよう");

    const boutenElement = readerView.locator("em.bouten");
    await expect(boutenElement.first()).toBeVisible();
    await expect(boutenElement.first()).toHaveText("覚醒");

    // 10. SQLite DB に本文データがキャッシュ保存されていることを確認
    const isChapterCached = await page.evaluate(
      async ({ novelId }) => {
        const services = window.__yommyServices!;
        const chapter = await services.chapterRepository.getChapter(novelId, 1);
        return {
          hasBody: Boolean(chapter?.bodyHtml && chapter.bodyHtml.length > 0),
          downloadedAt: chapter?.downloadedAt,
        };
      },
      { novelId },
    );

    expect(isChapterCached.hasBody).toBe(true);
    expect(isChapterCached.downloadedAt).not.toBeNull();
  });

  test("SCN-07-03: 非対応 URL での警告トースト（browser-unsupported-warning）表示、取り込みボタン disabled 確認、および「← 戻る」ボタン（browser-back-button）・OSバックキーによる直前画面（SCR-02 / 本棚）への論理復帰（TR-12）", async ({
    page,
  }) => {
    const sampleWorkUrl = "https://kakuyomu.jp/works/1177354054881162325";
    const novelId = "kakuyomu:1177354054881162325";

    // 1. テスト作品をシード登録して作品詳細 (SCR-02) を開く
    await page.evaluate(
      async ({ sampleWorkUrl }) => {
        const services = window.__yommyServices!;
        const initialIndex = {
          siteType: "kakuyomu" as const,
          remoteWorkId: "1177354054881162325",
          canonicalUrl: sampleWorkUrl,
          title: "境界迷宮と異界の魔術師",
          author: "小野崎",
          synopsis: "異世界に召喚された少年の冒険譚。",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "1177354054881162326",
              partTitle: null,
              title: "プロローグ：目覚め",
              url: "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326",
              publishedAt: null,
            },
          ],
          nextTocPageUrl: null,
        };
        await services.novelRepository.upsertNovelWithToc(
          initialIndex,
          new Date().toISOString(),
        );
      },
      { sampleWorkUrl, novelId },
    );

    // 本棚をリロードして登録作品を同期
    await page.reload();
    await page.waitForFunction(() =>
      Boolean(
        (window as unknown as { __yommyServices?: { isReady?: boolean } })
          .__yommyServices?.isReady,
      ),
    );

    // 作品詳細画面 (SCR-02) へ遷移
    const novelCard = page.getByTestId("novel-card-select");
    await expect(novelCard).toBeVisible();
    await novelCard.click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325$/,
    );
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();

    // 2. 「内蔵ブラウザで開く」を押下して内蔵ブラウザ画面 (SCR-04) へ遷移
    await page.getByTestId("open-webview-button").click();
    await expect(page.getByTestId("webview-import-page")).toBeVisible();

    // 3. 非対応 URL（例: https://example.com/unsupported）を入力して「移動」を押下
    const urlInput = page.getByTestId("browser-url-input");
    await urlInput.fill("https://example.com/unsupported");
    const navigateBtn = page.getByTestId("browser-navigate-button");
    await navigateBtn.click();

    // 4. 非対応 URL 警告トースト (browser-unsupported-warning) が表示されることを確認
    const unsupportedWarning = page.getByTestId("browser-unsupported-warning");
    await expect(unsupportedWarning).toBeVisible();
    await expect(unsupportedWarning).toContainText(
      "現在の URL は取り込みに対応していません",
    );

    // 5. 取り込み確定ボタン (import-dom-button) が disabled になることを確認
    const importBtn = page.getByTestId("import-dom-button");
    await expect(importBtn).toBeDisabled();

    // 6. ヘッダーの「← 戻る」ボタン (browser-back-button) を押下 (TR-12)
    const backBtn = page.getByTestId("browser-back-button");
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // 直前の作品詳細画面 (SCR-02) へ論理復帰することを確認
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325$/,
    );
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();

    // 7. 本棚画面 (SCR-01) から非対応 URL を開いたケースの論理復帰検証
    // 下部タブバーから本棚へ遷移
    await page.getByTestId("tab-bookshelf").click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();

    // 直接 /browser へ非対応 URL でアクセス
    await page.goto("/browser?url=https%3A%2F%2Fexample.com%2Fportal");
    await page.waitForFunction(() =>
      Boolean(
        (window as unknown as { __yommyServices?: { isReady?: boolean } })
          .__yommyServices?.isReady,
      ),
    );
    await expect(page.getByTestId("webview-import-page")).toBeVisible();
    await expect(page.getByTestId("browser-unsupported-warning")).toBeVisible();
    await expect(page.getByTestId("import-dom-button")).toBeDisabled();

    // Android OS バックキー操作による本棚 (/) への論理復帰を確認 (TR-12)
    await triggerBackButton(page);
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();
  });

  test("SCN-07-04: リーダー画面（SCR-03）からのブラウザ遷移後の論理復帰（TR-10 → TR-12）、危険なURLスキーム入力遮断（AC-WV-02）、および未登録作品エピソード直接取り込み時の保護エラー（AC-WV-07）", async ({
    page,
  }) => {
    const sampleWorkUrl = "https://kakuyomu.jp/works/1177354054881162325";
    const episodeUrl =
      "https://kakuyomu.jp/works/1177354054881162325/episodes/1177354054881162326";
    const novelId = "kakuyomu:1177354054881162325";

    // 1. 作品情報をローカル DB に登録（本文は未キャッシュ状態）
    await page.evaluate(
      async ({ sampleWorkUrl, episodeUrl }) => {
        const services = window.__yommyServices!;
        const initialIndex = {
          siteType: "kakuyomu" as const,
          remoteWorkId: "1177354054881162325",
          canonicalUrl: sampleWorkUrl,
          title: "境界迷宮と異界の魔術師",
          author: "小野崎",
          synopsis: "異世界に召喚された少年の冒険譚。",
          chapters: [
            {
              chapterIndex: 1,
              remoteChapterId: "1177354054881162326",
              partTitle: null,
              title: "プロローグ：目覚め",
              url: episodeUrl,
              publishedAt: null,
            },
          ],
          nextTocPageUrl: null,
        };
        await services.novelRepository.upsertNovelWithToc(
          initialIndex,
          new Date().toISOString(),
        );
      },
      { sampleWorkUrl, episodeUrl, novelId },
    );

    // 本棚をリロードして登録作品を同期
    await page.reload();
    await page.waitForFunction(() =>
      Boolean(
        (window as unknown as { __yommyServices?: { isReady?: boolean } })
          .__yommyServices?.isReady,
      ),
    );

    // エピソード取得時に通信エラー (HTTP 500) をシミュレート
    await page.evaluate(
      ({ episodeUrl }) => {
        const services = window.__yommyServices!;
        services.httpClient.setResponse(episodeUrl, {
          status: 500,
          headers: {},
          html: "Internal Server Error",
          url: episodeUrl,
        });
      },
      { episodeUrl },
    );

    // 2. 本棚から作品詳細 (SCR-02) を経由して第1話リーダー (SCR-03) を開く
    const novelCard = page.getByTestId("novel-card-select");
    await expect(novelCard).toBeVisible();
    await novelCard.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325$/,
    );
    const readFirstBtn = page.getByTestId("detail-read-first-button");
    await expect(readFirstBtn).toBeVisible();
    await readFirstBtn.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325\/chapters\/1$/,
    );

    // 3. 通信エラー画面の「内蔵ブラウザで開いて取り込む」ボタンを押下 (TR-10)
    const readerOpenWebviewBtn = page.getByTestId("reader-open-webview-button");
    await expect(readerOpenWebviewBtn).toBeVisible({ timeout: 10000 });
    await readerOpenWebviewBtn.click();

    // 4. 内蔵ブラウザ画面 (SCR-04) へ遷移することを確認
    await expect(page).toHaveURL(
      new RegExp(
        `/browser\\?url=${encodeURIComponent(episodeUrl)}&novelId=${encodeURIComponent(novelId)}&chapterIndex=1`,
      ),
    );
    const webviewImportPage = page.getByTestId("webview-import-page");
    await expect(webviewImportPage).toBeVisible();

    // 5. ヘッダーの「← 戻る」ボタンを押下して、元のリーダー画面 (SCR-03) へ論理復帰することを確認 (TR-12)
    const backBtn = page.getByTestId("browser-back-button");
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)1177354054881162325\/chapters\/1$/,
    );
    await expect(readerOpenWebviewBtn).toBeVisible();

    // 6. 再び内蔵ブラウザ画面へ進み、危険なスキーム（file://, javascript:）の入力遮断を検証 (AC-WV-02)
    await readerOpenWebviewBtn.click();
    await expect(page.getByTestId("webview-import-page")).toBeVisible();

    const urlInput = page.getByTestId("browser-url-input");
    const navigateBtn = page.getByTestId("browser-navigate-button");

    // 6-a: file:// スキーム入力
    await urlInput.fill("file:///etc/passwd");
    await navigateBtn.click();

    const browserError = page.getByTestId("browser-error");
    await expect(browserError).toBeVisible();
    await expect(browserError).toContainText(
      "安全でない URL スキームは開けません",
    );
    await expect(page.getByTestId("import-dom-button")).toBeDisabled();

    // 6-b: javascript: スキーム入力
    await urlInput.fill("javascript:alert(1)");
    await navigateBtn.click();
    await expect(browserError).toBeVisible();
    await expect(browserError).toContainText(
      "安全でない URL スキームは開けません",
    );
    await expect(page.getByTestId("import-dom-button")).toBeDisabled();

    // 7. 未登録作品のエピソード本文ページを直接開いて取り込もうとした場合の保護エラーを検証 (AC-WV-07)
    const unseededEpisodeUrl =
      "https://kakuyomu.jp/works/9999999999999999999/episodes/9999999999999999998";
    const unseededEpisodeHtml = `<!doctype html>
<html>
  <head><title>第1話 - カクヨム</title></head>
  <body>
    <div id="contentMain">
      <header class="widget-episode-header"><h1 class="widget-episodeTitle">第1話</h1></header>
      <div class="widget-episodeBody js-episode-body"><p>未登録作品の本文</p></div>
    </div>
  </body>
</html>`;

    // MockWebViewDomBridge にページをセット
    await page.evaluate(
      ({ unseededEpisodeUrl, unseededEpisodeHtml }) => {
        window.__yommyServices?.webViewDomBridge.setMockPage({
          url: unseededEpisodeUrl,
          title: "第1話 - カクヨム",
          html: unseededEpisodeHtml,
        });
      },
      { unseededEpisodeUrl, unseededEpisodeHtml },
    );

    // URL 入力欄に未登録作品エピソード URL を入力して移動
    await urlInput.fill(unseededEpisodeUrl);
    await navigateBtn.click();

    // エラーがクリアされ、取り込みボタンが活性化
    await expect(browserError).not.toBeVisible();
    const importBtn = page.getByTestId("import-dom-button");
    await expect(importBtn).toBeEnabled();

    // 取り込みボタンを押下
    await importBtn.click();

    // 未登録作品エラーメッセージが表示され、取り込みがガードされることを確認
    await expect(browserError).toBeVisible();
    await expect(browserError).toContainText(
      "先に作品トップ（目次）を取り込んでください",
    );
  });
});
