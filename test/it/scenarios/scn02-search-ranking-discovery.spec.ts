import { test, expect } from "@playwright/test";

test.describe("SCN-02: 検索・ランキング探索・その場追加・目次確認・リーダー読書・4タブ/OSバックキー論理階層遷移シナリオ", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
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

    // 2. 下部タブから「検索」タブ（/search）を選択（TR-01）
    await tabSearch.click();
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

    // 8. リーダーから OS バックキー（page.goBack()）で目次画面（SCR-02）へ復帰（TR-06）
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210101$/,
    );
    await expect(novelDetailPage).toBeVisible();
    await expect(tabRanking).toHaveAttribute("aria-selected", "true");

    // 9. 目次から OS バックキー（page.goBack()）で直前の探索元（ランキング）へ復帰（TR-07）
    await page.goBack();
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

    // 11. OS バックキー（TR-12）による下部タブ（設定・検索・ランキング）からホームタブ（本棚）への復帰検証
    // (a) 設定画面へ移動 -> OS バックキーで本棚へ復帰
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");
    await expect(tabSettings).toHaveAttribute("aria-selected", "true");

    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    // (b) 検索画面へ移動 -> OS バックキーで本棚へ復帰
    await tabSearch.click();
    await expect(page).toHaveURL("/search");
    await expect(tabSearch).toHaveAttribute("aria-selected", "true");

    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");

    // (c) ランキング画面へ移動 -> OS バックキーで本棚へ復帰
    await tabRanking.click();
    await expect(page).toHaveURL("/ranking");
    await expect(tabRanking).toHaveAttribute("aria-selected", "true");

    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(tabBookshelf).toHaveAttribute("aria-selected", "true");
  });
});
