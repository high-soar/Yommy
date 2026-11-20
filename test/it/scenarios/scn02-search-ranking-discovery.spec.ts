import { test, expect, type Page } from "@playwright/test";

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

async function waitForServicesReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window.__yommyServices !== "undefined" &&
      window.__yommyServices.isReady === true,
  );
}

test.describe("SCN-02: 検索・ランキング探索・その場追加・目次確認・リーダー読書・4タブ/OSバックキー論理階層遷移シナリオ", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await waitForServicesReady(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForServicesReady(page);
  });

  test("下部4タブ・検索・ランキング探索・その場追加・目次確認・リーダー読書・探索元復帰（TR-06, TR-07, TR-12）および本棚反映までの一連の動作が正常に機能する", async ({
    page,
  }) => {
    // 1. 初期表示（/）で全画面シェルおよび本棚の空状態、4タブ構成の下部タブバーを確認
    const appRoot = page.getByTestId("app-root");
    await expect(appRoot).toBeVisible();

    const bottomTabBar = page.getByTestId("bottom-tab-bar");
    await expect(bottomTabBar).toBeVisible();

    const tabBookshelf = page.getByTestId("tab-bookshelf");
    const tabSearch = page.getByTestId("tab-search");
    const tabRanking = page.getByTestId("tab-ranking");
    const tabSettings = page.getByTestId("tab-settings");

    await expect(tabBookshelf).toBeVisible();
    await expect(tabSearch).toBeVisible();
    await expect(tabRanking).toBeVisible();
    await expect(tabSettings).toBeVisible();
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    const emptyState = page.getByTestId("bookshelf-empty");
    await expect(emptyState).toBeVisible();

    // 2. 空状態の「小説を検索する」ボタンを押下して「検索」画面（/search）へ遷移（TR-15）
    const emptySearchButton = page.getByTestId("empty-search-button");
    await expect(emptySearchButton).toBeVisible();
    await emptySearchButton.click();

    await expect(page).toHaveURL("/search");
    await expect(tabSearch).toHaveAttribute("aria-selected", "true");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "false");

    const searchPage = page.getByTestId("search-page");
    await expect(searchPage).toBeVisible();
    await expect(page.getByTestId("search-initial-state")).toBeVisible();

    // 3. キーワード検索を実行（"異世界" 入力 -> 検索実行）し結果一覧を表示
    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("異世界");
    const searchSubmit = page.getByTestId("search-submit-button");
    await searchSubmit.click();

    const searchResultsList = page.getByTestId("search-results-list");
    await expect(searchResultsList).toBeVisible();

    // 検索結果カード（転生令嬢の異世界冒険譚）の表示確認
    const searchCard1 = page.getByTestId(
      "search-novel-card-16817330658027210001",
    );
    await expect(searchCard1).toBeVisible();
    await expect(searchCard1.getByTestId("search-card-title")).toHaveText(
      "転生令嬢の異世界冒険譚",
    );

    // 4. 結果カードの「＋ 本棚に追加」を押下し、「✓ 登録済み」へ切り替わることを確認（その場登録）
    const searchAddButton = searchCard1.getByTestId("search-card-add-button");
    await expect(searchAddButton).toBeVisible();
    await searchAddButton.click();

    const searchRegisteredButton = searchCard1.getByTestId(
      "search-card-registered-button",
    );
    await expect(searchRegisteredButton).toBeVisible();
    await expect(searchRegisteredButton).toHaveText("✓ 登録済み");
    // 画面遷移せず検索結果画面にとどまっていること
    await expect(page).toHaveURL("/search");

    // 5. 下部タブから「ランキング」タブ（/ranking）を選択（TR-01）
    await tabRanking.click();
    await expect(page).toHaveURL("/ranking");
    await expect(tabRanking).toHaveAttribute("aria-selected", "true");
    await expect(tabSearch).toHaveAttribute("aria-selected", "false");

    const rankingPage = page.getByTestId("ranking-page");
    await expect(rankingPage).toBeVisible();

    const rankingResultsList = page.getByTestId("ranking-results-list");
    await expect(rankingResultsList).toBeVisible();

    // 週間ランキング1位作品（ランキング1位作品：最強の剣士）が表示され、未登録状態であることを確認
    const rankCard1 = page.getByTestId(
      "ranking-novel-card-16817330658027210101",
    );
    await expect(rankCard1).toBeVisible();
    await expect(rankCard1.getByTestId("ranking-card-title")).toHaveText(
      "ランキング1位作品：最強の剣士",
    );
    const rankAddButton = rankCard1.getByTestId("ranking-card-add-button");
    await expect(rankAddButton).toBeVisible();

    // 6. 週間ランキングから作品カードをタップして作品詳細・目次（SCR-02）へ遷移（未登録からの自動追加＆シームレス遷移: TR-14）
    await rankCard1.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210101$/,
    );
    const novelDetailPage = page.getByTestId("novel-detail-page");
    await expect(novelDetailPage).toBeVisible();
    await expect(page.getByTestId("novel-detail-title")).toHaveText(
      "ランキング1位作品：最強の剣士",
    );

    // 直前の探索元である「ランキング」タブがアクティブであることを確認（novelOrigin 連携）
    await expect(bottomTabBar).toBeVisible();
    await expect(tabRanking).toHaveAttribute("aria-selected", "true");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "false");

    // 7. 目次からエピソードを選択してリーダー（SCR-03）へ移動し本文読書（TR-04）
    const episodeItems = page.getByTestId("episode-item");
    await expect(episodeItems.first()).toBeVisible();
    await episodeItems.first().click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210101\/chapters\/1$/,
    );
    const readerPage = page.getByTestId("reader-page");
    await expect(readerPage).toBeVisible();

    const readerBody = page.getByTestId("reader-body");
    await expect(readerBody).toBeVisible();

    // リーダー下部タッチゾーンをタップしてオーバーレイを表示
    const touchZone = page.getByTestId("reader-bottom-touch-zone");
    await touchZone.click();

    const overlay = page.getByTestId("reader-bottom-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveClass(/translate-y-0/);

    // リーダー下部オーバーレイでも探索元「ランキング」タブがアクティブであることを確認
    const overlayTabRanking = page.getByTestId("reader-bottom-tab-ranking");
    await expect(overlayTabRanking).toBeVisible();
    await expect(overlayTabRanking).toHaveAttribute("aria-selected", "true");

    // 前後話エピソード遷移（TR-05）の確認: 「次の話へ」で第2話へ進む
    const nextChapterButton = page.getByTestId("reader-next-chapter");
    await expect(nextChapterButton).toBeEnabled();
    await nextChapterButton.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210101\/chapters\/2$/,
    );
    await expect(readerBody).toBeVisible();

    // 8. リーダーから OS バックキー（triggerBackButton）で目次画面（SCR-02）へ復帰（TR-06）
    await triggerBackButton(page);
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210101$/,
    );
    await expect(novelDetailPage).toBeVisible();
    await expect(tabRanking).toHaveAttribute("aria-selected", "true");

    // 9. 目次から OS バックキー（triggerBackButton）で直前の探索元（ランキング）へ復帰（TR-07）
    await triggerBackButton(page);
    await expect(page).toHaveURL("/ranking");
    await expect(rankingPage).toBeVisible();
    await expect(tabRanking).toHaveAttribute("aria-selected", "true");

    // 自動追加された作品カードのボタンが「✓ 登録済み」へ切り替わっていることを確認
    const rankRegisteredButton = rankCard1.getByTestId(
      "ranking-card-registered-button",
    );
    await expect(rankRegisteredButton).toBeVisible();
    await expect(rankRegisteredButton).toHaveText("✓ 登録済み");

    // 10. 下部タブから「本棚」へ移動し、追加した2作品が本棚一覧に正しく反映されていることを確認
    await tabBookshelf.click();
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    const bookshelfPage = page.getByTestId("bookshelf-page");
    await expect(bookshelfPage).toBeVisible();
    await expect(page.getByTestId("bookshelf-empty")).toHaveCount(0);

    const novelCards = page.getByTestId("novel-card");
    await expect(novelCards).toHaveCount(2);

    const novelTitles = await page
      .getByTestId("novel-card-title")
      .allTextContents();
    expect(novelTitles).toContain("転生令嬢の異世界冒険譚");
    expect(novelTitles).toContain("ランキング1位作品：最強の剣士");

    // ランキング経由で第2話まで読書した作品のしおり進捗、および検索から未読追加した作品の状態確認
    const rankCard = novelCards.filter({
      hasText: "ランキング1位作品：最強の剣士",
    });
    await expect(rankCard.getByTestId("novel-card-bookmark")).toHaveText(
      "しおり: 第2話",
    );

    const searchCard = novelCards.filter({
      hasText: "転生令嬢の異世界冒険譚",
    });
    await expect(searchCard.getByTestId("novel-card-bookmark")).toHaveText(
      "未読",
    );

    // 11. OS バックキー（TR-12）による下部タブ（設定・検索・ランキング）からホームタブ（本棚）への論理階層復帰検証
    // (a) 設定画面へ移動 -> OS バックキーで本棚へ復帰
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");
    await expect(tabSettings).toHaveAttribute("aria-selected", "true");

    await triggerBackButton(page);
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    // (b) 検索画面へ移動 -> OS バックキーで本棚へ復帰
    await tabSearch.click();
    await expect(page).toHaveURL("/search");
    await expect(tabSearch).toHaveAttribute("aria-selected", "true");

    await triggerBackButton(page);
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    // (c) ランキング画面へ移動 -> OS バックキーで本棚へ復帰
    await tabRanking.click();
    await expect(page).toHaveURL("/ranking");
    await expect(tabRanking).toHaveAttribute("aria-selected", "true");

    await triggerBackButton(page);
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    // (d) /search -> /ranking と複数タブを渡り歩いた場合も、ブラウザ履歴ではなく本棚（/）へ復帰すること（TR-12）
    await tabSearch.click();
    await expect(page).toHaveURL("/search");
    await tabRanking.click();
    await expect(page).toHaveURL("/ranking");

    await triggerBackButton(page);
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");
  });

  test("ランキング集計期間・ジャンル切替時および検索条件変更時の再取得・順位バッジ・ローディング表示・操作抑止・入力維持が正常に機能すること (AC-RK-02, AC-RK-03, AC-RK-04, AC-RK-08, AC-SE-03, AC-SE-04, AC-SE-09)", async ({
    page,
  }) => {
    // 0. ランキング（1〜4位）・検索リクエストの遅延／エラー応答をテスト側から制御できるよう httpClient モックを準備
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const client = services.httpClient as unknown as {
        getHtml: (options: { url: string; signal?: AbortSignal }) => Promise<{
          status: number;
          url: string;
          headers: Record<string, string>;
          html: string;
        }>;
        setResponse: (
          pattern: string | RegExp,
          handler: (options: { url: string; signal?: AbortSignal }) => Promise<{
            status: number;
            url: string;
            headers: Record<string, string>;
            html: string;
          }>,
        ) => void;
      };

      const baseRankRes = await client.getHtml({
        url: "https://kakuyomu.jp/rankings/all/weekly?work_variation=long",
      });
      // 4位作品を追加したランキング HTML（AC-RK-04 の1〜3位強調スタイルと4位通常スタイル比較用）
      const rankDoc = new DOMParser().parseFromString(
        baseRankRes.html,
        "text/html",
      );
      const rankNextData = rankDoc.querySelector("script#__NEXT_DATA__");
      if (rankNextData?.textContent) {
        const parsed = JSON.parse(rankNextData.textContent);
        const apollo = parsed.props.pageProps.__APOLLO_STATE__;
        const rootKey = Object.keys(apollo.ROOT_QUERY).find((k) =>
          k.startsWith("rankedWorks"),
        );
        if (rootKey) {
          apollo.ROOT_QUERY[rootKey].nodes.push({
            __ref: "Work:16817330658027210104",
          });
          apollo["UserAccount:rankUser4"] = {
            __typename: "UserAccount",
            id: "rankUser4",
            activityName: "ランキング4位作家",
          };
          apollo["Work:16817330658027210104"] = {
            __typename: "Work",
            id: "16817330658027210104",
            title: "ランキング4位作品：平凡商人の旅",
            author: { __ref: "UserAccount:rankUser4" },
            introduction: "旅する商人の日常ファンタジー。",
            genre: "FANTASY",
            serialStatus: "RUNNING",
            publicEpisodeCount: 25,
            totalCharacterCount: 72000,
            tagLabels: ["商人", "旅"],
            totalReviewPoint: 5400,
            lastEpisodePublishedAt: "2026-10-26T10:00:00Z",
          };
          rankNextData.textContent = JSON.stringify(parsed);
        }
      }
      const rankHtml4Items =
        "<!doctype html>" + rankDoc.documentElement.outerHTML;

      const baseSearchRes = await client.getHtml({
        url: "https://kakuyomu.jp/search?q=%E7%95%B0%E4%B8%96%E7%95%8C",
      });
      const searchHtml = baseSearchRes.html;

      let rankingHold = false;
      let rankingShouldFail = false;
      const pendingRankingResolvers: Array<{
        resolve: (res: {
          status: number;
          url: string;
          headers: Record<string, string>;
          html: string;
        }) => void;
        reject: (err: Error) => void;
        url: string;
      }> = [];

      let searchHold = false;
      const pendingSearchResolvers: Array<{
        resolve: (res: {
          status: number;
          url: string;
          headers: Record<string, string>;
          html: string;
        }) => void;
        url: string;
      }> = [];

      client.setResponse(/^https:\/\/kakuyomu\.jp\/rankings\//, (options) => {
        if (rankingHold) {
          return new Promise((resolve, reject) => {
            pendingRankingResolvers.push({ resolve, reject, url: options.url });
          });
        }
        if (rankingShouldFail) {
          return Promise.reject(new Error("ランキング通信エラー"));
        }
        return Promise.resolve({
          status: 200,
          url: options.url,
          headers: {},
          html: rankHtml4Items,
        });
      });

      client.setResponse(/^https:\/\/kakuyomu\.jp\/search/, (options) => {
        if (searchHold) {
          return new Promise((resolve) => {
            pendingSearchResolvers.push({ resolve, url: options.url });
          });
        }
        return Promise.resolve({
          status: 200,
          url: options.url,
          headers: {},
          html: searchHtml,
        });
      });

      (
        window as unknown as {
          __scn02Gate?: {
            holdRanking: () => void;
            resolveRanking: () => void;
            setRankingFail: (fail: boolean) => void;
            holdSearch: () => void;
            resolveSearch: () => void;
          };
        }
      ).__scn02Gate = {
        holdRanking: () => {
          rankingHold = true;
        },
        resolveRanking: () => {
          rankingHold = false;
          for (const entry of pendingRankingResolvers.splice(0)) {
            if (rankingShouldFail) {
              entry.reject(new Error("ランキング通信エラー"));
            } else {
              entry.resolve({
                status: 200,
                url: entry.url,
                headers: {},
                html: rankHtml4Items,
              });
            }
          }
        },
        setRankingFail: (fail: boolean) => {
          rankingShouldFail = fail;
        },
        holdSearch: () => {
          searchHold = true;
        },
        resolveSearch: () => {
          searchHold = false;
          for (const entry of pendingSearchResolvers.splice(0)) {
            entry.resolve({
              status: 200,
              url: entry.url,
              headers: {},
              html: searchHtml,
            });
          }
        },
      };
    });

    // 1. ランキング画面へ移動し、1〜3位強調バッジおよび4位通常バッジを検証（AC-RK-04）
    const tabRanking = page.getByTestId("tab-ranking");
    await tabRanking.click();
    await expect(page).toHaveURL("/ranking");
    const rankingList = page.getByTestId("ranking-results-list");
    await expect(rankingList).toBeVisible();

    const rank1Badge = page
      .getByTestId("ranking-novel-card-16817330658027210101")
      .getByTestId("ranking-card-rank-badge");
    const rank2Badge = page
      .getByTestId("ranking-novel-card-16817330658027210102")
      .getByTestId("ranking-card-rank-badge");
    const rank3Badge = page
      .getByTestId("ranking-novel-card-16817330658027210103")
      .getByTestId("ranking-card-rank-badge");
    const rank4Badge = page
      .getByTestId("ranking-novel-card-16817330658027210104")
      .getByTestId("ranking-card-rank-badge");

    await expect(rank1Badge).toHaveText("1位");
    await expect(rank1Badge).toHaveClass(/bg-amber-400/);
    await expect(rank2Badge).toHaveText("2位");
    await expect(rank2Badge).toHaveClass(/bg-slate-300/);
    await expect(rank3Badge).toHaveText("3位");
    await expect(rank3Badge).toHaveClass(/bg-amber-700/);
    await expect(rank4Badge).toHaveText("4位");
    await expect(rank4Badge).toHaveClass(/bg-slate-100/);

    // 2. 集計期間を「月間」へ切り替え、遅延モック応答中に ranking-loading 表示・旧一覧消去・操作抑止（disabled）を検証（AC-RK-02, AC-RK-08）
    await page.evaluate(() => {
      (
        window as unknown as { __scn02Gate: { holdRanking: () => void } }
      ).__scn02Gate.holdRanking();
    });

    const monthlyPeriodBtn = page.getByTestId("ranking-period-monthly");
    const dailyPeriodBtn = page.getByTestId("ranking-period-daily");
    const shortVariationBtn = page.getByTestId("ranking-variation-short");
    const fantasyGenreBtn = page.getByTestId("ranking-genre-fantasy");
    const rankingSiteKakuyomu = page
      .getByTestId("ranking-page")
      .getByTestId("site-selector-kakuyomu");
    const rankingSiteNarou = page
      .getByTestId("ranking-page")
      .getByTestId("site-selector-narou");

    await expect(monthlyPeriodBtn).toBeVisible();
    await monthlyPeriodBtn.click();
    await expect(monthlyPeriodBtn).toHaveAttribute("aria-pressed", "true");

    const rankingLoading = page.getByTestId("ranking-loading");
    await expect(rankingLoading).toBeVisible();
    await expect(rankingList).toHaveCount(0);
    await expect(dailyPeriodBtn).toBeDisabled();
    await expect(monthlyPeriodBtn).toBeDisabled();
    await expect(shortVariationBtn).toBeDisabled();
    await expect(fantasyGenreBtn).toBeDisabled();
    await expect(rankingSiteKakuyomu).toBeDisabled();
    await expect(rankingSiteNarou).toBeDisabled();

    await page.evaluate(() => {
      (
        window as unknown as { __scn02Gate: { resolveRanking: () => void } }
      ).__scn02Gate.resolveRanking();
    });

    await expect(rankingLoading).not.toBeVisible();
    await expect(rankingList).toBeVisible();
    await expect(dailyPeriodBtn).toBeEnabled();
    await expect(shortVariationBtn).toBeEnabled();
    await expect(fantasyGenreBtn).toBeEnabled();
    await expect(rankingSiteKakuyomu).toBeEnabled();
    await expect(rankingSiteNarou).toBeEnabled();

    // 作品種別を「短編」へ切り替え（AC-RK-10, Issue #265）
    await expect(shortVariationBtn).toBeVisible();
    await shortVariationBtn.click();
    await expect(shortVariationBtn).toHaveAttribute("aria-pressed", "true");
    await expect(rankingList).toBeVisible();

    // 3. ジャンル切り替え時の通信エラーによる ranking-error 表示（旧データ非残留）および再試行復旧を検証（AC-RK-03, AC-RK-08）
    await page.evaluate(() => {
      const gate = (
        window as unknown as {
          __scn02Gate: { setRankingFail: (fail: boolean) => void };
        }
      ).__scn02Gate;
      gate.setRankingFail(true);
    });
    await expect(fantasyGenreBtn).toBeVisible();
    await fantasyGenreBtn.click();
    await expect(fantasyGenreBtn).toHaveAttribute("aria-pressed", "true");

    const rankingError = page.getByTestId("ranking-error");
    await expect(rankingError).toBeVisible();
    await expect(rankingList).toHaveCount(0);

    await page.evaluate(() => {
      const gate = (
        window as unknown as {
          __scn02Gate: { setRankingFail: (fail: boolean) => void };
        }
      ).__scn02Gate;
      gate.setRankingFail(false);
    });
    await page.getByTestId("ranking-error-retry-button").click();
    await expect(rankingError).not.toBeVisible();
    await expect(rankingList).toBeVisible();

    // 4. 検索画面へ移動（AC-SE-03, AC-SE-04, AC-SE-09）
    const tabSearch = page.getByTestId("tab-search");
    await tabSearch.click();
    await expect(page).toHaveURL("/search");

    // 除外キーワード入力欄も開いた状態で初回検索実行
    const excludeToggle = page.getByTestId("search-exclude-toggle-button");
    await excludeToggle.click();
    const excludeInput = page.getByTestId("search-exclude-input");
    await expect(excludeInput).toBeVisible();

    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("異世界");
    const searchSubmit = page.getByTestId("search-submit-button");
    await searchSubmit.click();
    const searchList = page.getByTestId("search-results-list");
    await expect(searchList).toBeVisible();

    // 並び順変更による再取得中の search-loading 表示・旧一覧消去・ボタン/フィルタ無効化・キーワード入力維持を検証（AC-SE-03, AC-SE-09）
    await page.evaluate(() => {
      (
        window as unknown as { __scn02Gate: { holdSearch: () => void } }
      ).__scn02Gate.holdSearch();
    });

    const orderSelect = page.getByTestId("search-order-select");
    const serialAllBtn = page.getByTestId("search-serial-all");
    const serialCompleteBtn = page.getByTestId("search-serial-completed");
    const serialShortBtn = page.getByTestId("search-serial-short");
    const searchAllGenreBtn = page.getByTestId("search-genre-all");
    const fantasyPill = page.getByTestId("search-genre-fantasy");
    const searchSiteKakuyomu = page
      .getByTestId("search-page")
      .getByTestId("site-selector-kakuyomu");
    const searchSiteNarou = page
      .getByTestId("search-page")
      .getByTestId("site-selector-narou");

    await orderSelect.selectOption("popular");
    await expect(orderSelect).toHaveValue("popular");

    const searchLoading = page.getByTestId("search-loading");
    await expect(searchLoading).toBeVisible();
    await expect(searchList).toHaveCount(0);
    await expect(searchSubmit).toBeDisabled();
    await expect(orderSelect).toBeDisabled();
    await expect(serialAllBtn).toBeDisabled();
    await expect(serialCompleteBtn).toBeDisabled();
    await expect(searchAllGenreBtn).toBeDisabled();
    await expect(fantasyPill).toBeDisabled();
    await expect(searchSiteKakuyomu).toBeDisabled();
    await expect(searchSiteNarou).toBeDisabled();

    // 通信中もキーワード入力および除外キーワード入力は有効かつフォーカス・入力内容が維持されること（AC-SE-09）
    await expect(searchInput).toBeEnabled();
    await expect(excludeInput).toBeEnabled();
    await expect(searchInput).toHaveValue("異世界");
    await searchInput.focus();
    await page.keyboard.type("冒険");
    await expect(searchInput).toBeFocused();
    await expect(searchInput).toHaveValue("異世界冒険");

    await page.evaluate(() => {
      (
        window as unknown as { __scn02Gate: { resolveSearch: () => void } }
      ).__scn02Gate.resolveSearch();
    });

    await expect(searchLoading).not.toBeVisible();
    await expect(searchList).toBeVisible();
    await expect(searchInput).toHaveValue("異世界冒険");
    await expect(searchSubmit).toBeEnabled();
    await expect(orderSelect).toBeEnabled();
    await expect(serialCompleteBtn).toBeEnabled();
    await expect(fantasyPill).toBeEnabled();
    await expect(searchSiteKakuyomu).toBeEnabled();
    await expect(searchSiteNarou).toBeEnabled();

    // 連載状態フィルタ変更による再取得（AC-SE-04, AC-SE-09, R1-24, Issue #265）
    await serialCompleteBtn.click();
    await expect(serialCompleteBtn).toHaveAttribute("aria-pressed", "true");
    await expect(searchList).toBeVisible();

    await serialShortBtn.click();
    await expect(serialShortBtn).toHaveAttribute("aria-pressed", "true");
    await expect(searchList).toBeVisible();

    // ジャンルピル変更による再取得（AC-SE-05, AC-SE-09, R1-24）
    await fantasyPill.click();
    await expect(fantasyPill).toHaveAttribute("aria-pressed", "true");
    await expect(searchList).toBeVisible();
  });

  test("小説家になろうへのサイト切替・小ジャンル連動・検索・ランキング探索・その場追加・リーダー読書・本棚反映が正常に機能すること (AC-RK-09, AC-SE-10)", async ({
    page,
  }) => {
    const tabRanking = page.getByTestId("tab-ranking");
    const tabSearch = page.getByTestId("tab-search");
    const tabBookshelf = page.getByTestId("tab-bookshelf");

    // 1. 初期表示（/）から「検索」画面（/search）へ移動
    await tabSearch.click();
    await expect(page).toHaveURL("/search");
    const searchPage = page.getByTestId("search-page");
    await expect(searchPage).toBeVisible();

    // 2. 検索画面のサイト切替: 初期カクヨム -> 「小説家になろう」を選択 (AC-SE-10)
    const siteNarouSearch = searchPage.getByTestId("site-selector-narou");
    await expect(siteNarouSearch).toBeVisible();
    await expect(siteNarouSearch).toHaveAttribute("aria-pressed", "false");
    await siteNarouSearch.click();
    await expect(siteNarouSearch).toHaveAttribute("aria-pressed", "true");

    // なろう小ジャンルピルが表示されること（カクヨムジャンルは非表示）
    const searchGenreIsekaiRomance = page.getByTestId("search-genre-101");
    await expect(searchGenreIsekaiRomance).toBeVisible();
    await expect(page.getByTestId("search-genre-fantasy")).toHaveCount(0);

    // 3. キーワード検索（"無職転生"）を実行し、なろう検索結果一覧を表示
    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("無職転生");
    const searchSubmit = page.getByTestId("search-submit-button");
    await searchSubmit.click();

    const searchList = page.getByTestId("search-results-list");
    await expect(searchList).toBeVisible();

    // なろう検索結果カード（n9669bk: 無職転生 - 異世界行ったら本気だす -）の確認
    const narouSearchCard = page.getByTestId("search-novel-card-n9669bk");
    await expect(narouSearchCard).toBeVisible();
    await expect(narouSearchCard.getByTestId("search-card-title")).toHaveText(
      "無職転生 - 異世界行ったら本気だす -",
    );

    // 4. 検索結果カードの「＋ 本棚に追加」を押下し、「✓ 登録済み」へ切り替わることを確認（その場登録）
    const searchAddBtn = narouSearchCard.getByTestId("search-card-add-button");
    await expect(searchAddBtn).toBeVisible();
    await searchAddBtn.click();
    const searchRegisteredBtn = narouSearchCard.getByTestId(
      "search-card-registered-button",
    );
    await expect(searchRegisteredBtn).toBeVisible();
    await expect(searchRegisteredBtn).toHaveText("✓ 登録済み");

    // 5. 下部タブから「ランキング」画面（/ranking）へ移動
    await tabRanking.click();
    await expect(page).toHaveURL("/ranking");
    const rankingPage = page.getByTestId("ranking-page");
    await expect(rankingPage).toBeVisible();

    // 6. ランキング画面のサイト切替: 初期カクヨム -> 「小説家になろう」を選択 (AC-RK-09)
    const siteNarouRanking = rankingPage.getByTestId("site-selector-narou");
    await expect(siteNarouRanking).toBeVisible();
    await expect(siteNarouRanking).toHaveAttribute("aria-pressed", "false");
    await siteNarouRanking.click();
    await expect(siteNarouRanking).toHaveAttribute("aria-pressed", "true");

    // 7. なろうランキング一覧が表示され、小ジャンルピル（101, 201等）が表示されること
    const rankingList = page.getByTestId("ranking-results-list");
    await expect(rankingList).toBeVisible();

    const genreHighFantasy = page.getByTestId("ranking-genre-201");
    await expect(genreHighFantasy).toBeVisible();
    await expect(page.getByTestId("ranking-genre-fantasy")).toHaveCount(0); // カクヨムジャンルは非表示

    // なろうランキング1位作品カードの確認（未登録状態）
    const narouRankCard1 = page.getByTestId("ranking-novel-card-n1001aa");
    await expect(narouRankCard1).toBeVisible();
    await expect(narouRankCard1.getByTestId("ranking-card-title")).toHaveText(
      "デイリー1位作品",
    );
    const narouRankAddBtn = narouRankCard1.getByTestId(
      "ranking-card-add-button",
    );
    await expect(narouRankAddBtn).toBeVisible();

    // 8. ジャンルピル「ハイファンタジー (201)」を選択し、一覧が再取得されること
    await genreHighFantasy.click();
    await expect(genreHighFantasy).toHaveAttribute("aria-pressed", "true");
    await expect(rankingList).toBeVisible();

    // 9. なろうランキングから作品カードをタップして作品詳細・目次（SCR-02）へ遷移（未登録からの自動追加＆シームレス遷移: TR-14）
    await narouRankCard1.click();
    await expect(page).toHaveURL(/\/novels\/narou(%3A|:)n1001aa$/);
    const novelDetailPage = page.getByTestId("novel-detail-page");
    await expect(novelDetailPage).toBeVisible();
    await expect(page.getByTestId("novel-detail-title")).toHaveText(
      "デイリー1位作品",
    );

    // 探索元「ランキング」タブがアクティブであること
    await expect(tabRanking).toHaveAttribute("aria-selected", "true");

    // 10. 第1話を選択してリーダー（SCR-03）へ移動し本文読書
    const episodeItems = page.getByTestId("episode-item");
    // 探索画面からの自動登録により 2 ページ分の目次（全5話）が結合保存されていることを確認 (R1-02)
    await expect(episodeItems).toHaveCount(5);
    await expect(episodeItems.first()).toBeVisible();
    await episodeItems.first().click();

    await expect(page).toHaveURL(/\/novels\/narou(%3A|:)n1001aa\/chapters\/1$/);
    const readerPage = page.getByTestId("reader-page");
    await expect(readerPage).toBeVisible();
    await expect(page.getByTestId("reader-body")).toBeVisible();

    // 縦書き組版属性、前書き・区切り線・後書き、ルビ、傍点の描画確認 (R1-02, AC-NR-06, AC-NR-07)
    await expect(
      page.locator('[data-writing-mode="vertical-rl"]'),
    ).toBeVisible();
    const readerContent = page.getByTestId("reader-content");
    await expect(readerContent).toBeVisible();
    await expect(readerContent).toContainText("これは前書きです。");
    await expect(readerContent).toContainText("────────────");
    await expect(readerContent).toContainText(
      "読んでいただきありがとうございました。",
    );
    await expect(page.locator("ruby rt", { hasText: "まほう" })).toBeVisible();
    await expect(page.locator("em.bouten")).toHaveCount(3);

    // 11. OSバックキーで目次画面へ復帰、さらにOSバックキーでランキング画面へ復帰 (TR-06, TR-07)
    await triggerBackButton(page);
    await expect(page).toHaveURL(/\/novels\/narou(%3A|:)n1001aa$/);
    await expect(novelDetailPage).toBeVisible();

    await triggerBackButton(page);
    await expect(page).toHaveURL("/ranking");
    await expect(rankingPage).toBeVisible();
    await expect(tabRanking).toHaveAttribute("aria-selected", "true");

    // 再マウントされたランキング画面でなろうを選択し、自動追加された作品カードが「✓ 登録済み」に更新されていることを確認
    await siteNarouRanking.click();
    await expect(siteNarouRanking).toHaveAttribute("aria-pressed", "true");
    const narouRankRegBtn = narouRankCard1.getByTestId(
      "ranking-card-registered-button",
    );
    await expect(narouRankRegBtn).toBeVisible();
    await expect(narouRankRegBtn).toHaveText("✓ 登録済み");

    // 12. 「本棚」タブへ移動し、検索からその場追加した作品とランキングから自動追加された作品の2件が反映されていることを確認
    await tabBookshelf.click();
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    const bookshelfPage = page.getByTestId("bookshelf-page");
    await expect(bookshelfPage).toBeVisible();

    const novelCards = page.getByTestId("novel-card");
    await expect(novelCards).toHaveCount(2);

    const novelTitles = await page
      .getByTestId("novel-card-title")
      .allTextContents();
    expect(novelTitles).toContain("デイリー1位作品");
    expect(novelTitles).toContain("無職転生 - 異世界行ったら本気だす");
  });

  test("検索画面で除外キーワード指定および複数ジャンル選択による高度絞り込み検索が正常に機能すること (AC-SE-11)", async ({
    page,
  }) => {
    // 0. HTTP クライアントのリクエスト URL を捕捉してクエリパラメータを検証できるようにする (R1-03)
    await page.evaluate(() => {
      const services = window.__yommyServices!;
      const client = services.httpClient as unknown as {
        getHtml: (options: { url: string }) => Promise<unknown>;
      };
      (window as unknown as { __capturedUrls: string[] }).__capturedUrls = [];
      const origGetHtml = client.getHtml.bind(client);
      client.getHtml = async (options: { url: string }) => {
        (window as unknown as { __capturedUrls: string[] }).__capturedUrls.push(
          options.url,
        );
        return origGetHtml(options);
      };
    });

    // 1. 検索画面へ移動
    const tabSearch = page.getByTestId("tab-search");
    await tabSearch.click();
    await expect(page).toHaveURL("/search");
    const searchPage = page.getByTestId("search-page");
    await expect(searchPage).toBeVisible();

    // 2. カクヨム: 除外キーワードトグルボタンを押下して入力欄を展開
    const excludeToggle = page.getByTestId("search-exclude-toggle-button");
    await expect(excludeToggle).toBeVisible();
    await expect(excludeToggle).toHaveAttribute("aria-expanded", "false");
    await excludeToggle.click();
    await expect(excludeToggle).toHaveAttribute("aria-expanded", "true");

    const excludeInput = page.getByTestId("search-exclude-input");
    await expect(excludeInput).toBeVisible();

    // 3. キーワードと除外キーワードを入力
    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("異世界");
    await excludeInput.fill("チート");

    // 除外キーワードクリアボタンの存在確認
    const excludeClearBtn = page.getByTestId("search-exclude-clear-button");
    await expect(excludeClearBtn).toBeVisible();

    // トグルボタンでパネルを閉じた際も、除外語設定中は強調表示（data-active="true"）が維持され、aria-controls は除去されること (AC-SE-11, R2-09)
    await excludeToggle.click();
    await expect(excludeToggle).toHaveAttribute("aria-expanded", "false");
    await expect(excludeToggle).toHaveAttribute("data-active", "true");
    await expect(excludeToggle).not.toHaveAttribute("aria-controls");
    await expect(excludeInput).toHaveCount(0);

    // 再展開してクリアボタン押下による消去と再入力を検証 (AC-SE-11)
    await excludeToggle.click();
    await expect(excludeToggle).toHaveAttribute("aria-expanded", "true");
    await expect(excludeToggle).toHaveAttribute("aria-controls", /.+/);
    await expect(excludeInput).toBeVisible();
    await expect(excludeInput).toHaveValue("チート");

    await excludeClearBtn.click();
    await expect(excludeInput).toHaveValue("");
    await expect(excludeToggle).not.toHaveAttribute("data-active");

    // 検索用に再度除外キーワードを入力
    await excludeInput.fill("チート");
    await expect(excludeToggle).toHaveAttribute("data-active", "true");

    // 4. カクヨム複数ジャンルピルを選択（異世界ファンタジー + 現代ファンタジー）
    const fantasyPill = page.getByTestId("search-genre-fantasy");
    const actionPill = page.getByTestId("search-genre-action");
    const allPill = page.getByTestId("search-genre-all");

    await fantasyPill.click();
    await expect(fantasyPill).toHaveAttribute("aria-pressed", "true");
    await expect(allPill).toHaveAttribute("aria-pressed", "false");

    await actionPill.click();
    await expect(actionPill).toHaveAttribute("aria-pressed", "true");
    await expect(fantasyPill).toHaveAttribute("aria-pressed", "true");

    // 5. 検索実行
    const searchSubmit = page.getByTestId("search-submit-button");
    await searchSubmit.click();

    const searchList = page.getByTestId("search-results-list");
    await expect(searchList).toBeVisible();
    const searchCard1 = page.getByTestId(
      "search-novel-card-16817330658027210001",
    );
    await expect(searchCard1).toBeVisible();

    // カクヨム検索 URL のクエリパラメータを決定論的にポーリング検証 (AC-SE-11, R1-03, R2-11)
    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://kakuyomu.jp/search"));
        });
        if (!url) return null;
        const parsed = new URL(url);
        return {
          q: parsed.searchParams.get("q"),
          genreName: parsed.searchParams.get("genre_name"),
        };
      })
      .toEqual({
        q: "異世界 -チート",
        genreName: "fantasy,action",
      });

    // 6. 小説家になろうへサイト切り替え（除外キーワードが維持され、ジャンルがリセットされること）
    const siteNarouSearch = searchPage.getByTestId("site-selector-narou");
    await siteNarouSearch.click();
    await expect(siteNarouSearch).toHaveAttribute("aria-pressed", "true");

    // 除外キーワードが維持されていること
    await expect(excludeInput).toHaveValue("チート");

    // なろうジャンルの「すべて」がアクティブであること
    const narouAllPill = page.getByTestId("search-genre-all");
    await expect(narouAllPill).toHaveAttribute("aria-pressed", "true");

    // なろう小ジャンル（101 + 201）を複数選択
    const narou101 = page.getByTestId("search-genre-101");
    const narou201 = page.getByTestId("search-genre-201");
    await narou101.click();
    await expect(narou101).toHaveAttribute("aria-pressed", "true");
    await expect(narouAllPill).toHaveAttribute("aria-pressed", "false");

    await narou201.click();
    await expect(narou201).toHaveAttribute("aria-pressed", "true");
    await expect(narou101).toHaveAttribute("aria-pressed", "true");

    // 7. 再検索実行
    await searchSubmit.click();
    await expect(searchList).toBeVisible();

    // なろう検索 URL のクエリパラメータを決定論的にポーリング検証 (AC-SE-11, R1-03, R2-11)
    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://api.syosetu.com/novelapi/api/"));
        });
        if (!url) return null;
        const parsed = new URL(url);
        return {
          word: parsed.searchParams.get("word"),
          notword: parsed.searchParams.get("notword"),
          genre: parsed.searchParams.get("genre"),
        };
      })
      .toEqual({
        word: "異世界",
        notword: "チート",
        genre: "101-201",
      });
  });

  test("ランキングおよび検索画面で作品種別（短編・長編・すべて）の切替とサイト切替時の状態保持が正常に機能すること (AC-RK-10, AC-SE-04, AC-SE-10, Issue #265)", async ({
    page,
  }) => {
    // 0. HTTP クライアントのリクエスト URL を捕捉して作品種別パラメータを検証 (R1-03, R2-11, R2-18)
    await page.evaluate(() => {
      const services = window.__yommyServices!;
      const client = services.httpClient as unknown as {
        getHtml: (options: { url: string }) => Promise<unknown>;
      };
      (window as unknown as { __capturedUrls: string[] }).__capturedUrls = [];
      const origGetHtml = client.getHtml.bind(client);
      client.getHtml = async (options: { url: string }) => {
        (window as unknown as { __capturedUrls: string[] }).__capturedUrls.push(
          options.url,
        );
        return origGetHtml(options);
      };
    });

    // 1. ランキング画面へ移動
    const tabRanking = page.getByTestId("tab-ranking");
    await tabRanking.click();
    await expect(page).toHaveURL("/ranking");

    const rankingList = page.getByTestId("ranking-results-list");
    await expect(rankingList).toBeVisible();

    // デフォルトで「長編・連載」が選択されていること
    const variationLong = page.getByTestId("ranking-variation-long");
    const variationShort = page.getByTestId("ranking-variation-short");
    const variationAll = page.getByTestId("ranking-variation-all");
    await expect(variationLong).toHaveAttribute("aria-pressed", "true");
    await expect(variationShort).toHaveAttribute("aria-pressed", "false");
    await expect(variationAll).toHaveAttribute("aria-pressed", "false");

    // カクヨムランキング初期表示 URL の検証 (work_variation=long: R2-11)
    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://kakuyomu.jp/rankings/"));
        });
        if (!url) return null;
        const parsed = new URL(url);
        return {
          pathname: parsed.pathname,
          workVariation: parsed.searchParams.get("work_variation"),
        };
      })
      .toEqual({
        pathname: "/rankings/all/weekly",
        workVariation: "long",
      });

    // 「短編」を選択
    await variationShort.click();
    await expect(variationShort).toHaveAttribute("aria-pressed", "true");
    await expect(variationLong).toHaveAttribute("aria-pressed", "false");
    await expect(rankingList).toBeVisible();

    // カクヨム短編ランキング URL パラメータ検証 (work_variation=short: R1-03, R2-11)
    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://kakuyomu.jp/rankings/"));
        });
        return url ? new URL(url).searchParams.get("work_variation") : null;
      })
      .toBe("short");

    // なろうへサイト切り替え -> 作品種別「短編」が維持されていること
    const siteNarouRanking = page.getByTestId("site-selector-narou");
    await siteNarouRanking.click();
    await expect(siteNarouRanking).toHaveAttribute("aria-pressed", "true");
    await expect(variationShort).toHaveAttribute("aria-pressed", "true");
    await expect(rankingList).toBeVisible();

    // なろう短編ランキング URL パラメータ検証 (type=t: R1-03, R2-11)
    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://api.syosetu.com/novelapi/api/"));
        });
        return url ? new URL(url).searchParams.get("type") : null;
      })
      .toBe("t");

    // なろうで「長編・連載」を選択 -> type=re が付与されること (R2-11)
    await variationLong.click();
    await expect(variationLong).toHaveAttribute("aria-pressed", "true");
    await expect(rankingList).toBeVisible();

    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://api.syosetu.com/novelapi/api/"));
        });
        return url ? new URL(url).searchParams.get("type") : null;
      })
      .toBe("re");

    // なろうで「すべて」を選択
    await variationAll.click();
    await expect(variationAll).toHaveAttribute("aria-pressed", "true");
    await expect(rankingList).toBeVisible();

    // なろう「すべて」ランキング URL パラメータ検証 (type パラメータなし: R1-03, R2-11)
    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://api.syosetu.com/novelapi/api/"));
        });
        if (!url) return "MISSING";
        return new URL(url).searchParams.get("type");
      })
      .toBeNull();

    // カクヨムへサイト切り替え -> 作品種別「すべて」が維持されていること
    const siteKakuyomuRanking = page.getByTestId("site-selector-kakuyomu");
    await siteKakuyomuRanking.click();
    await expect(siteKakuyomuRanking).toHaveAttribute("aria-pressed", "true");
    await expect(variationAll).toHaveAttribute("aria-pressed", "true");
    await expect(rankingList).toBeVisible();

    // カクヨム「すべて」ランキング URL パラメータ検証 (work_variation=all: R1-03, R2-11)
    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://kakuyomu.jp/rankings/"));
        });
        return url ? new URL(url).searchParams.get("work_variation") : null;
      })
      .toBe("all");

    // 2. 検索画面へ移動
    const tabSearch = page.getByTestId("tab-search");
    await tabSearch.click();
    await expect(page).toHaveURL("/search");

    // デフォルトで連載状況「すべて」が選択されていること
    const serialAll = page.getByTestId("search-serial-all");
    const serialRunning = page.getByTestId("search-serial-running");
    const serialCompleted = page.getByTestId("search-serial-completed");
    const serialShort = page.getByTestId("search-serial-short");
    await expect(serialAll).toHaveAttribute("aria-pressed", "true");
    await expect(serialShort).toHaveAttribute("aria-pressed", "false");

    // キーワード入力
    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("異世界");

    // 「短編」ピルを選択して検索実行
    await serialShort.click();
    await expect(serialShort).toHaveAttribute("aria-pressed", "true");
    await expect(serialAll).toHaveAttribute("aria-pressed", "false");

    const searchSubmit = page.getByTestId("search-submit-button");
    await searchSubmit.click();

    const searchList = page.getByTestId("search-results-list");
    await expect(searchList).toBeVisible();

    // カクヨム短編検索 URL パラメータ検証 (serial_status=completed かつ total_character_count_range=-20000: R1-03, R2-11, R2-18)
    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://kakuyomu.jp/search"));
        });
        if (!url) return null;
        const parsed = new URL(url);
        return {
          serialStatus: parsed.searchParams.get("serial_status"),
          charRange: parsed.searchParams.get("total_character_count_range"),
        };
      })
      .toEqual({
        serialStatus: "completed",
        charRange: "-20000",
      });

    // なろうへサイト切り替え -> 連載状況「短編」が維持されていること
    const siteNarouSearch = page.getByTestId("site-selector-narou");
    await siteNarouSearch.click();
    await expect(siteNarouSearch).toHaveAttribute("aria-pressed", "true");
    await expect(serialShort).toHaveAttribute("aria-pressed", "true");
    await expect(searchList).toBeVisible();

    // なろう短編検索 URL パラメータ検証 (type=t: R1-03, R2-11)
    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://api.syosetu.com/novelapi/api/"));
        });
        return url ? new URL(url).searchParams.get("type") : null;
      })
      .toBe("t");

    // なろう検索で「連載中」ピルを選択 -> type=r が付与されること (R2-11)
    await serialRunning.click();
    await expect(serialRunning).toHaveAttribute("aria-pressed", "true");
    await expect(searchList).toBeVisible();

    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://api.syosetu.com/novelapi/api/"));
        });
        return url ? new URL(url).searchParams.get("type") : null;
      })
      .toBe("r");

    // なろう検索で「完結済」ピルを選択 -> type=er が付与されること (R2-11)
    await serialCompleted.click();
    await expect(serialCompleted).toHaveAttribute("aria-pressed", "true");
    await expect(searchList).toBeVisible();

    await expect
      .poll(async () => {
        const url = await page.evaluate(() => {
          const urls = (window as unknown as { __capturedUrls: string[] })
            .__capturedUrls;
          return urls
            .slice()
            .reverse()
            .find((u) => u.startsWith("https://api.syosetu.com/novelapi/api/"));
        });
        return url ? new URL(url).searchParams.get("type") : null;
      })
      .toBe("er");
  });

  test("検索画面での次ページ読み込み（search-load-more-button）および直近確定クエリ保持が正常に機能すること (AC-SE-08)", async ({
    page,
  }) => {
    // 0. 1ページ目・2ページ目応答および URL 記録用モックを設定
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const client = services.httpClient as unknown as {
        getHtml: (options: { url: string }) => Promise<{
          status: number;
          url: string;
          headers: Record<string, string>;
          html: string;
        }>;
        setResponse: (
          pattern: string | RegExp,
          handler: (options: { url: string }) => Promise<{
            status: number;
            url: string;
            headers: Record<string, string>;
            html: string;
          }>,
        ) => void;
      };

      const baseRes = await client.getHtml({
        url: "https://kakuyomu.jp/search?q=%E7%95%B0%E4%B8%96%E7%95%8C",
      });
      const page1Html = baseRes.html;

      const doc2 = new DOMParser().parseFromString(page1Html, "text/html");
      const nextData2 = doc2.querySelector("script#__NEXT_DATA__");
      if (nextData2?.textContent) {
        const parsed2 = JSON.parse(nextData2.textContent);
        const apollo2 = parsed2.props.pageProps.__APOLLO_STATE__;
        const rootKey = Object.keys(apollo2.ROOT_QUERY).find((k) =>
          k.startsWith("searchWorks"),
        );
        if (rootKey) {
          apollo2.ROOT_QUERY[rootKey].pageInfo = {
            __typename: "PageInfo",
            hasNextPage: false,
            hasPreviousPage: true,
          };
          apollo2.ROOT_QUERY[rootKey].nodes = [
            { __ref: "Work:16817330658027210003" },
            { __ref: "Work:16817330658027210004" },
          ];
          apollo2["UserAccount:author3"] = {
            __typename: "UserAccount",
            id: "author3",
            name: "saburo_user",
            activityName: "三郎丸",
          };
          apollo2["Work:16817330658027210003"] = {
            __typename: "Work",
            id: "16817330658027210003",
            title: "次ページ作品A：星界の錬金術師",
            author: { __ref: "UserAccount:author3" },
            introduction: "2ページ目で取得される錬金術ファンタジー。",
            genre: "FANTASY",
            serialStatus: "RUNNING",
            publicEpisodeCount: 30,
            totalCharacterCount: 95000,
            tagLabels: ["錬金術", "星界"],
            totalReviewPoint: 4100,
            lastEpisodePublishedAt: "2026-10-22T12:00:00Z",
          };
          apollo2["Work:16817330658027210004"] = {
            __typename: "Work",
            id: "16817330658027210004",
            title: "次ページ作品B：迷宮都市の鍛冶屋",
            author: { __ref: "UserAccount:author3" },
            introduction: "2ページ目で取得される鍛冶職人スローライフ。",
            genre: "ACTION",
            serialStatus: "COMPLETED",
            publicEpisodeCount: 55,
            totalCharacterCount: 180000,
            tagLabels: ["鍛冶", "迷宮"],
            totalReviewPoint: 6200,
            lastEpisodePublishedAt: "2026-10-19T09:00:00Z",
          };
          nextData2.textContent = JSON.stringify(parsed2);
        }
      }
      const page2Html = "<!doctype html>" + doc2.documentElement.outerHTML;

      const capturedUrls: string[] = [];
      const pendingPage2Resolvers: Array<
        (res: {
          status: number;
          url: string;
          headers: Record<string, string>;
          html: string;
        }) => void
      > = [];

      client.setResponse(/^https:\/\/kakuyomu\.jp\/search/, (options) => {
        capturedUrls.push(options.url);
        const parsedUrl = new URL(options.url);
        if (parsedUrl.searchParams.get("page") === "2") {
          return new Promise((resolve) => {
            pendingPage2Resolvers.push(resolve);
          });
        }
        return Promise.resolve({
          status: 200,
          url: options.url,
          headers: {},
          html: page1Html,
        });
      });

      (
        window as unknown as {
          __scn02Pagination?: {
            getCapturedUrls: () => string[];
            resolvePage2: () => void;
          };
        }
      ).__scn02Pagination = {
        getCapturedUrls: () => capturedUrls,
        resolvePage2: () => {
          const page2Url =
            capturedUrls.find(
              (u) => new URL(u).searchParams.get("page") === "2",
            ) ?? "https://kakuyomu.jp/search?page=2";
          for (const resolve of pendingPage2Resolvers.splice(0)) {
            resolve({
              status: 200,
              url: page2Url,
              headers: {},
              html: page2Html,
            });
          }
        },
      };
    });

    // 1. 検索画面へ移動して初回検索（"異世界"）を実行
    await page.getByTestId("tab-search").click();
    await expect(page).toHaveURL("/search");

    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("異世界");
    await page.getByTestId("search-submit-button").click();

    await expect(page.getByTestId("search-results-list")).toBeVisible();
    await expect(
      page.getByTestId("search-novel-card-16817330658027210001"),
    ).toBeVisible();
    await expect(
      page.getByTestId("search-novel-card-16817330658027210002"),
    ).toBeVisible();

    const loadMoreBtn = page.getByTestId("search-load-more-button");
    await expect(loadMoreBtn).toBeVisible();
    await expect(loadMoreBtn).toContainText("さらに読み込む");

    // 2. 検索バーを未確定文字列へ編集（送信はしない）した上で「さらに読み込む」を押下
    await searchInput.fill("未送信の編集キーワード");
    await loadMoreBtn.click();

    // 2ページ目通信中は読み込み中表示かつボタン無効化、既存1ページ目カードは保持されること
    await expect(loadMoreBtn).toBeDisabled();
    await expect(loadMoreBtn).toContainText("読み込み中...");
    await expect(
      page.getByTestId("search-novel-card-16817330658027210001"),
    ).toBeVisible();

    // 3. 2ページ目遅延モック応答を解決
    await page.evaluate(() => {
      (
        window as unknown as {
          __scn02Pagination: { resolvePage2: () => void };
        }
      ).__scn02Pagination.resolvePage2();
    });

    // 4. 1ページ目＋2ページ目の全4作品が追記表示され、次ページ無しのためボタンが消滅すること
    await expect(
      page.getByTestId("search-novel-card-16817330658027210003"),
    ).toBeVisible();
    await expect(
      page.getByTestId("search-novel-card-16817330658027210004"),
    ).toBeVisible();
    await expect(loadMoreBtn).toHaveCount(0);

    // 5. 2ページ目リクエスト URL が未送信編集値ではなく直近確定クエリ（"異世界"）を保持していたことを検証（AC-SE-08）
    const page2QueryInfo = await page.evaluate(() => {
      const urls = (
        window as unknown as {
          __scn02Pagination: { getCapturedUrls: () => string[] };
        }
      ).__scn02Pagination.getCapturedUrls();
      const p2 = urls.find((u) => new URL(u).searchParams.get("page") === "2");
      if (!p2) return null;
      const parsed = new URL(p2);
      return {
        q: parsed.searchParams.get("q"),
        page: parsed.searchParams.get("page"),
        order: parsed.searchParams.get("order"),
      };
    });
    expect(page2QueryInfo).toEqual({
      q: "異世界",
      page: "2",
      order: "weekly_ranking",
    });
  });
});
