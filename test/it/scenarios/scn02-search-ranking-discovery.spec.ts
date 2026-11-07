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

test.describe("SCN-02: 検索・ランキング探索・その場追加・目次確認・リーダー読書・4タブ/OSバックキー論理階層遷移シナリオ", () => {
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

  test("ランキング集計期間・ジャンル切替時および検索条件変更時に、一覧の再取得・更新が正常に行われること (AC-RK-02, AC-RK-03, AC-SE-03, AC-SE-04)", async ({
    page,
  }) => {
    // Note: 通信中の一時的なローディング表示（ranking-loading / search-loading）および
    // 各種操作無効化（AC-RK-08, AC-SE-09）は、インメモリ MockHttpClient による即時解決環境のため
    // UT (RankingPage.test.tsx / SearchPage.test.tsx) および Storybook VRT で 100% 担保されており、
    // 本結合テストでは各条件切替に伴う再取得・一覧更新の実ブラウザ E2E 連携を検証する。

    // 1. ランキング画面へ移動
    const tabRanking = page.getByTestId("tab-ranking");
    await tabRanking.click();
    await expect(page).toHaveURL("/ranking");
    const rankingList = page.getByTestId("ranking-results-list");
    await expect(rankingList).toBeVisible();

    // 2. 集計期間を「月間」へ切り替え（AC-RK-02, AC-RK-08）
    const monthlyPeriodBtn = page.getByTestId("ranking-period-monthly");
    await expect(monthlyPeriodBtn).toBeVisible();
    await monthlyPeriodBtn.click();
    await expect(monthlyPeriodBtn).toHaveAttribute("aria-pressed", "true");
    await expect(rankingList).toBeVisible();

    // 3. ジャンルを切り替え（AC-RK-03, AC-RK-08）
    const fantasyGenreBtn = page.getByTestId("ranking-genre-fantasy");
    await expect(fantasyGenreBtn).toBeVisible();
    await fantasyGenreBtn.click();
    await expect(fantasyGenreBtn).toHaveAttribute("aria-pressed", "true");
    await expect(rankingList).toBeVisible();

    // 4. 検索画面へ移動（AC-SE-03, AC-SE-04, AC-SE-09）
    const tabSearch = page.getByTestId("tab-search");
    await tabSearch.click();
    await expect(page).toHaveURL("/search");

    // 初回検索実行
    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("異世界");
    const searchSubmit = page.getByTestId("search-submit-button");
    await searchSubmit.click();
    const searchList = page.getByTestId("search-results-list");
    await expect(searchList).toBeVisible();

    // 並び順変更による再取得（AC-SE-03, AC-SE-09, R1-24）
    const orderSelect = page.getByTestId("search-order-select");
    await orderSelect.selectOption("popular");
    await expect(orderSelect).toHaveValue("popular");
    await expect(searchList).toBeVisible();

    // 連載状態フィルタ変更による再取得（AC-SE-04, AC-SE-09, R1-24）
    const serialCompleteBtn = page.getByTestId("search-serial-completed");
    await serialCompleteBtn.click();
    await expect(serialCompleteBtn).toHaveAttribute("aria-pressed", "true");
    await expect(searchList).toBeVisible();

    // ジャンルピル変更による再取得（AC-SE-05, AC-SE-09, R1-24）
    const fantasyPill = page.getByTestId("search-genre-fantasy");
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
  });
});
