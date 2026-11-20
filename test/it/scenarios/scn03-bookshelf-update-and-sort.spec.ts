import { test, expect, type Page } from "@playwright/test";

async function waitForServicesReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window.__yommyServices !== "undefined" &&
      window.__yommyServices.isReady === true,
  );
}

test.describe("SCN-03: 本棚自動更新チェック・NEW表示/解除・手動一括更新・5種ソート永続化・お気に入りトグル/フィルタ/更新連動シナリオ (HO-18, HO-19, HO-32)", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await waitForServicesReady(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForServicesReady(page);
  });

  test("本棚自動更新チェック・NEWバッジ表示と詳細/リーダー遷移時解除・手動一括更新・5種ソート切替/永続化・お気に入りトグル/フィルタ/更新連動が正常に機能する", async ({
    page,
  }) => {
    // 1. 初期状態の空本棚確認
    const bookshelfPage = page.getByTestId("bookshelf-page");
    await expect(bookshelfPage).toBeVisible();
    await expect(page.getByTestId("bookshelf-empty")).toBeVisible();

    // 2. 作品データを2件シード登録
    // 作品1: カクヨム作品（境界迷宮と異界の魔術師）。初回登録時に話数をあらかじめ2話だけにして登録し、前回チェック日時を2時間前に設定することで、自動更新チェックが走った際に新着話数を検知して NEW バッジが付くようにする。
    // 作品2: カクヨム作品（あいうえおの冒険）。前回チェック日時を現在にし、直近チェック済みとする。
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

      // 初回は 2 話分のみとして登録
      const partialIndex = {
        ...parsedIndex,
        totalChapters: 2,
        chapters: parsedIndex.chapters.slice(0, 2),
      };
      await services.novelRepository.upsertNovelWithToc(
        partialIndex,
        new Date().toISOString(),
      );

      // 作品1の last_checked_at および updated_at を 2時間前（自動更新チェック対象: 1時間以上経過）に設定、has_new_update = 0 に設定 (R2-05)
      const work1Id = `${parsedIndex.siteType}:${parsedIndex.remoteWorkId}`;
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      await services.databaseAdapter.execute(
        "UPDATE novels SET last_checked_at = ?, updated_at = ?, has_new_update = 0 WHERE id = ?",
        [twoHoursAgo, twoHoursAgo, work1Id],
      );

      // 作品2を直接 DB に登録（50音順で作品1より前になるタイトル: "あいうえおの冒険"）
      const novel2Id = "kakuyomu:16817330658027210002";
      const now = new Date().toISOString();
      await services.databaseAdapter.execute(
        `INSERT INTO novels (
          id, site_type, remote_work_id, canonical_url, title, author, synopsis,
          total_chapters, cached_chapters, bookmark_chapter_index, bookmark_scroll_progress,
          is_favorite, has_new_update, latest_episode_published_at, last_checked_at, last_read_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          novel2Id,
          "kakuyomu",
          "16817330658027210002",
          "https://kakuyomu.jp/works/16817330658027210002",
          "あいうえおの冒険",
          "作者A",
          "あいうえおの冒険あらすじ",
          5,
          1,
          1,
          0,
          0,
          0,
          "2026-10-27T00:00:00Z",
          now, // 直近チェック済みのため自動更新対象外
          "2026-10-28T00:00:00Z",
          "2026-10-20T00:00:00Z",
          "2026-10-27T00:00:00Z",
        ],
      );

      // 作品2の第1話を登録
      await services.databaseAdapter.execute(
        `INSERT INTO chapters (
          id, novel_id, chapter_index, remote_chapter_id, part_title, title, url,
          body_html, byte_size, is_read, published_at, downloaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${novel2Id}:1`,
          novel2Id,
          1,
          "1",
          null,
          "第1話 はじまり",
          "https://kakuyomu.jp/works/16817330658027210002/episodes/1",
          "<p>冒険が始まる。</p>",
          100,
          0,
          "2026-10-27T00:00:00Z",
          now,
        ],
      );
    });

    // 3. ページをリロードして本棚を開く（自動更新チェックが走り、作品1に NEW バッジが表示される）
    await page.reload();
    await waitForServicesReady(page);

    // 作品カードが2件表示されるのを待つ
    const novelCards = page.getByTestId("novel-card");
    await expect(novelCards).toHaveCount(2);

    // 作品1（境界迷宮と異界の魔術師）に NEW バッジが表示されること（AC-BS-08, HO-18）
    // 自動更新チェックは非同期に実行され、完了後に再取得されるため expect で待機
    const novelCardWork1 = novelCards.filter({
      hasText: "境界迷宮と異界の魔術師",
    });
    const newBadgeWork1 = novelCardWork1.getByTestId("novel-card-new-badge");
    await expect(newBadgeWork1).toBeVisible({ timeout: 10000 });
    await expect(newBadgeWork1).toHaveText("NEW");

    // 作品2（あいうえおの冒険）には NEW バッジが表示されていないこと
    const novelCardWork2 = novelCards.filter({
      hasText: "あいうえおの冒険",
    });
    await expect(
      novelCardWork2.getByTestId("novel-card-new-badge"),
    ).toHaveCount(0);

    // 4. 作品詳細表示による NEW バッジ解除検証 (HO-18, AC-BS-09, TR-02, AC-ND-10)
    // 作品1のカード本文（novel-card-select）をクリックして作品詳細へ遷移
    await novelCardWork1.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    await expect(page.getByTestId("novel-detail-page")).toBeVisible();
    await expect(page.getByTestId("novel-detail-title")).toHaveText(
      "境界迷宮と異界の魔術師",
    );

    // ブラウザ戻る操作で本棚へ復帰
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();

    // 作品1の NEW バッジが解除されていること
    const novelCardWork1AfterDetail = page
      .getByTestId("novel-card")
      .filter({ hasText: "境界迷宮と異界の魔術師" });
    await expect(
      novelCardWork1AfterDetail.getByTestId("novel-card-new-badge"),
    ).toHaveCount(0);

    // 5. リーダー閲覧による NEW バッジ解除検証 (HO-18, AC-BS-09, TR-03, AC-RD-07)
    // 作品2に NEW フラグ（has_new_update = 1）を直接設定
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      await services.databaseAdapter.execute(
        "UPDATE novels SET has_new_update = 1 WHERE id = ?",
        ["kakuyomu:16817330658027210002"],
      );
    });
    await page.reload();
    await waitForServicesReady(page);

    const novelCardWork2WithNew = page
      .getByTestId("novel-card")
      .filter({ hasText: "あいうえおの冒険" });
    // 作品2に NEW バッジが表示されていること
    await expect(
      novelCardWork2WithNew.getByTestId("novel-card-new-badge"),
    ).toBeVisible();

    // 作品2の「第1話から読む」（novel-card-resume）をクリックしてリーダー画面へ遷移
    await novelCardWork2WithNew.getByTestId("novel-card-resume").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210002\/chapters\/1$/,
    );
    await expect(page.getByTestId("reader-page")).toBeVisible();
    await expect(page.getByTestId("reader-view")).toBeVisible();

    // リーダー画面からブラウザ戻る操作で論理階層（作品詳細）を経て本棚へ復帰（fromBookshelfResume仕様）
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210002$/,
    );
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();

    // 作品2の NEW バッジが解除されていること
    const novelCardWork2AfterReader = page
      .getByTestId("novel-card")
      .filter({ hasText: "あいうえおの冒険" });
    await expect(
      novelCardWork2AfterReader.getByTestId("novel-card-new-badge"),
    ).toHaveCount(0);

    // 6. 5種ソート切り替えと app_settings 永続化・再表示復元 (HO-19, AC-BS-11, TR-16)
    const sortSelect = page.getByTestId("bookshelf-sort-select");
    await expect(sortSelect).toBeVisible();
    // (a) 初期選択値は "unread_first"（更新あり優先）
    await expect(sortSelect).toHaveValue("unread_first");

    // (b) "title"（タイトル順: 昇順）へ変更
    await sortSelect.selectOption("title");
    await expect(sortSelect).toHaveValue("title");

    const cardsAfterSort = page.getByTestId("novel-card");
    // タイトル順では "あいうえおの冒険"（インデックス0）→ "境界迷宮と異界の魔術師"（インデックス1）
    await expect(
      cardsAfterSort.nth(0).getByTestId("novel-card-title"),
    ).toHaveText("あいうえおの冒険");
    await expect(
      cardsAfterSort.nth(1).getByTestId("novel-card-title"),
    ).toHaveText("境界迷宮と異界の魔術師");

    // ページをリロードして永続化（app_settings）と復元を確認
    await page.reload();
    await waitForServicesReady(page);
    const reloadedSortSelect = page.getByTestId("bookshelf-sort-select");
    await expect(reloadedSortSelect).toBeVisible();
    await expect(reloadedSortSelect).toHaveValue("title");

    const reloadedCards = page.getByTestId("novel-card");
    await expect(
      reloadedCards.nth(0).getByTestId("novel-card-title"),
    ).toHaveText("あいうえおの冒険");
    await expect(
      reloadedCards.nth(1).getByTestId("novel-card-title"),
    ).toHaveText("境界迷宮と異界の魔術師");

    // (c) "latest_published"（作品更新日順）への変更確認
    await reloadedSortSelect.selectOption("latest_published");
    await expect(reloadedSortSelect).toHaveValue("latest_published");
    const pubCards = page.getByTestId("novel-card");
    // latest_episode_published_at: あいうえおの冒険 (2026-10-27) > 境界迷宮 (2026-01-04)
    await expect(pubCards.nth(0).getByTestId("novel-card-title")).toHaveText(
      "あいうえおの冒険",
    );
    await expect(pubCards.nth(1).getByTestId("novel-card-title")).toHaveText(
      "境界迷宮と異界の魔術師",
    );

    // (d) "last_read"（最近読んだ順）への変更確認
    await reloadedSortSelect.selectOption("last_read");
    await expect(reloadedSortSelect).toHaveValue("last_read");
    const readCards = page.getByTestId("novel-card");
    // last_read_at: あいうえおの冒険（ステップ5でリーダー閲覧）> 境界迷宮（未閲覧・null）
    await expect(readCards.nth(0).getByTestId("novel-card-title")).toHaveText(
      "あいうえおの冒険",
    );
    await expect(readCards.nth(1).getByTestId("novel-card-title")).toHaveText(
      "境界迷宮と異界の魔術師",
    );

    // (e) "created_at"（登録日順: 降順）への変更確認
    await reloadedSortSelect.selectOption("created_at");
    await expect(reloadedSortSelect).toHaveValue("created_at");
    const createdCards = page.getByTestId("novel-card");
    // created_at: 境界迷宮（ステップ2でシード登録）> あいうえおの冒険 (2026-10-20)
    await expect(
      createdCards.nth(0).getByTestId("novel-card-title"),
    ).toHaveText("境界迷宮と異界の魔術師");
    await expect(
      createdCards.nth(1).getByTestId("novel-card-title"),
    ).toHaveText("あいうえおの冒険");

    // 7. 手動一括更新ボタンの押下と進捗表示・結果反映 (AC-BS-10, TR-17)
    // R2-05 (R1-01 / No.236 回帰保証): 自動更新チェック・詳細閲覧・リーダー閲覧（しおり更新）を経ても、両作品の updated_at が変化していないことを検証
    const updatedAtBeforeManualRefresh = await page.evaluate(async () => {
      const services = window.__yommyServices!;
      return await services.databaseAdapter.query<{
        id: string;
        updated_at: string;
      }>("SELECT id, updated_at FROM novels ORDER BY id");
    });
    const work2BeforeRefresh = updatedAtBeforeManualRefresh.find(
      (r) => r.id === "kakuyomu:16817330658027210002",
    );
    const work1BeforeRefresh = updatedAtBeforeManualRefresh.find(
      (r) => r.id === "kakuyomu:16817330658027210412",
    );
    expect(work2BeforeRefresh?.updated_at).toBe("2026-10-27T00:00:00Z");
    expect(work1BeforeRefresh?.updated_at).toBeTruthy();

    const refreshButton = page.getByTestId("bookshelf-refresh-button");
    await expect(refreshButton).toBeVisible();
    await expect(refreshButton).toBeEnabled();

    await refreshButton.click();

    // 更新実行中は進捗表示が表示され、更新ボタンが無効化されること (AC-BS-10)
    const refreshProgress = page.getByTestId("bookshelf-refresh-progress");
    await expect(refreshProgress).toBeVisible();
    await expect(refreshButton).toBeDisabled();

    // 更新完了後に進捗表示が非表示となり、更新ボタンが再活性化されること (TR-17)
    await expect(refreshProgress).not.toBeVisible({ timeout: 15000 });
    await expect(refreshButton).toBeEnabled();

    // TR-17 の結果反映: 作品1の更新確認日時 (last_checked_at) が更新され、かつ updated_at は保護されて変化していないこと (R2-05)
    const rowsAfterManualRefresh = await page.evaluate(async () => {
      const services = window.__yommyServices!;
      return await services.databaseAdapter.query<{
        id: string;
        last_checked_at: string;
        updated_at: string;
      }>("SELECT id, last_checked_at, updated_at FROM novels ORDER BY id");
    });
    const work1AfterRefresh = rowsAfterManualRefresh.find(
      (r) => r.id === "kakuyomu:16817330658027210412",
    );
    const work2AfterRefresh = rowsAfterManualRefresh.find(
      (r) => r.id === "kakuyomu:16817330658027210002",
    );
    expect(work1AfterRefresh?.last_checked_at).toBeTruthy();
    const checkedTime = new Date(work1AfterRefresh!.last_checked_at).getTime();
    expect(Date.now() - checkedTime).toBeLessThan(30000);
    // 手動一括更新チェック（upsertNovelWithToc）前後で updated_at が変化しないこと (R1-01 / R2-05)
    expect(work1AfterRefresh?.updated_at).toBe(work1BeforeRefresh?.updated_at);
    expect(work2AfterRefresh?.updated_at).toBe("2026-10-27T00:00:00Z");

    // =========================================================================
    // 8. 本棚カードおよび作品詳細ヘッダーでのお気に入り（★）登録・解除と画面間連動 (AC-BS-14, AC-ND-23, HO-32, R2-05, R2-19)
    // =========================================================================
    // (a) 本棚カード上の novel-card-favorite-button によるお気に入り登録・解除
    const cardWork1 = page
      .getByTestId("novel-card")
      .filter({ hasText: "境界迷宮と異界の魔術師" });
    const favButtonWork1 = cardWork1.getByTestId("novel-card-favorite-button");
    await expect(favButtonWork1).toBeVisible();
    await expect(favButtonWork1).toHaveAttribute("aria-pressed", "false");
    await expect(favButtonWork1).toHaveAttribute(
      "aria-label",
      "境界迷宮と異界の魔術師のお気に入り",
    );

    // 作品1をお気に入りに登録（クリックで詳細画面へ遷移せず、その場で切り替わること: stopPropagation）
    await favButtonWork1.click();
    await expect(page).toHaveURL("/");
    await expect(favButtonWork1).toHaveAttribute("aria-pressed", "true");
    await expect(favButtonWork1).toHaveAttribute(
      "aria-label",
      "境界迷宮と異界の魔術師のお気に入り",
    );

    // DB に is_favorite = 1 と updated_at の増加が反映されていることを確認 (AC-BS-14, R2-05)
    const work1FavRow = await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const rows = await services.databaseAdapter.query<{
        is_favorite: number;
        updated_at: string;
      }>(
        "SELECT is_favorite, updated_at FROM novels WHERE id = 'kakuyomu:16817330658027210412'",
      );
      return rows[0];
    });
    expect(work1FavRow?.is_favorite).toBe(1);
    expect(Date.parse(work1FavRow!.updated_at)).toBeGreaterThan(
      Date.parse(work1BeforeRefresh!.updated_at),
    );

    // (b) 作品詳細ヘッダーの detail-favorite-toggle-button によるお気に入り登録と本棚連動 (AC-ND-23, R2-05, R2-19)
    const cardWork2 = page
      .getByTestId("novel-card")
      .filter({ hasText: "あいうえおの冒険" });
    await cardWork2.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210002$/,
    );

    const detailFavBtn = page.getByTestId("detail-favorite-toggle-button");
    await expect(detailFavBtn).toBeVisible();
    await expect(detailFavBtn).toHaveAttribute("aria-label", "お気に入り");
    await expect(detailFavBtn).toHaveAttribute("aria-pressed", "false");
    await expect(detailFavBtn).toHaveText("☆");

    // 作品詳細ヘッダーでお気に入り登録
    await detailFavBtn.click();
    await expect(detailFavBtn).toHaveAttribute("aria-pressed", "true");
    await expect(detailFavBtn).toHaveText("★");

    // 作品詳細でのお気に入りトグルでも DB の updated_at が実際に新しい日時へ増加していることを確認 (AC-ND-23, R2-05)
    const work2FavRow = await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const rows = await services.databaseAdapter.query<{
        is_favorite: number;
        updated_at: string;
      }>(
        "SELECT is_favorite, updated_at FROM novels WHERE id = 'kakuyomu:16817330658027210002'",
      );
      return rows[0];
    });
    expect(work2FavRow?.is_favorite).toBe(1);
    expect(Date.parse(work2FavRow!.updated_at)).toBeGreaterThan(
      Date.parse("2026-10-27T00:00:00Z"),
    );

    // ブラウザ戻るで本棚へ復帰し、作品2カードのお気に入り状態が ★（aria-pressed=true）になっていることを確認
    await page.goBack();
    await expect(page).toHaveURL("/");
    const cardWork2Back = page
      .getByTestId("novel-card")
      .filter({ hasText: "あいうえおの冒険" });
    const favButtonWork2 = cardWork2Back.getByTestId(
      "novel-card-favorite-button",
    );
    await expect(favButtonWork2).toHaveAttribute("aria-pressed", "true");

    // (c) 本棚カードから作品2のお気に入りを解除し、作品詳細へ再度遷移して反映を確認
    await favButtonWork2.click();
    await expect(favButtonWork2).toHaveAttribute("aria-pressed", "false");

    await cardWork2Back.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210002$/,
    );
    await expect(
      page.getByTestId("detail-favorite-toggle-button"),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("detail-favorite-toggle-button")).toHaveText(
      "☆",
    );

    await page.goBack();
    await expect(page).toHaveURL("/");

    // =========================================================================
    // 9. 本棚ヘッダーお気に入りフィルタ（bookshelf-favorite-filter-button）による絞り込み表示とソート併用 (AC-BS-15, TR-16, R2-20)
    // =========================================================================
    // 現在の状態: 作品1（境界迷宮）のみお気に入り（isFavorite=true）、作品2（あいうえお）は非お気に入り
    const favFilterButton = page.getByTestId(
      "bookshelf-favorite-filter-button",
    );
    await expect(favFilterButton).toBeVisible();
    await expect(favFilterButton).toHaveAttribute("aria-pressed", "false");
    await expect(favFilterButton).toHaveText("☆");

    // お気に入りフィルタを ON に切り替え
    await favFilterButton.click();
    await expect(favFilterButton).toHaveAttribute("aria-pressed", "true");
    await expect(favFilterButton).toHaveText("★");

    // お気に入りの作品1のみが表示され、作品2は除外されること
    const filteredCards = page.getByTestId("novel-card");
    await expect(filteredCards).toHaveCount(1);
    await expect(
      filteredCards.nth(0).getByTestId("novel-card-title"),
    ).toHaveText("境界迷宮と異界の魔術師");

    // ソートとの併用検証: 作品2もお気に入りに登録し、フィルタ ON の状態で2件が正しくソートされることを確認
    // 一時的にお気に入りフィルタを OFF にして全件表示
    await favFilterButton.click();
    await expect(favFilterButton).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("novel-card")).toHaveCount(2);

    // 作品2もお気に入りに登録
    const cardWork2ForFilter = page
      .getByTestId("novel-card")
      .filter({ hasText: "あいうえおの冒険" });
    await cardWork2ForFilter.getByTestId("novel-card-favorite-button").click();
    await expect(
      cardWork2ForFilter.getByTestId("novel-card-favorite-button"),
    ).toHaveAttribute("aria-pressed", "true");

    // お気に入りフィルタを再度 ON にする
    await favFilterButton.click();
    await expect(favFilterButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("novel-card")).toHaveCount(2);

    // ソート順を "title"（タイトル順）へ変更
    const filterSortSelect = page.getByTestId("bookshelf-sort-select");
    await filterSortSelect.selectOption("title");
    const favSortedCards = page.getByTestId("novel-card");
    await expect(
      favSortedCards.nth(0).getByTestId("novel-card-title"),
    ).toHaveText("あいうえおの冒険");
    await expect(
      favSortedCards.nth(1).getByTestId("novel-card-title"),
    ).toHaveText("境界迷宮と異界の魔術師");

    // ソート順を "created_at"（登録日順）へ変更
    await filterSortSelect.selectOption("created_at");
    const favSortedCardsCreated = page.getByTestId("novel-card");
    await expect(
      favSortedCardsCreated.nth(0).getByTestId("novel-card-title"),
    ).toHaveText("境界迷宮と異界の魔術師");
    await expect(
      favSortedCardsCreated.nth(1).getByTestId("novel-card-title"),
    ).toHaveText("あいうえおの冒険");

    // 作品2のお気に入りを取り消して、作品1のみがお気に入り状態に戻す
    const cardWork2InFav = page
      .getByTestId("novel-card")
      .filter({ hasText: "あいうえおの冒険" });
    await cardWork2InFav.getByTestId("novel-card-favorite-button").click();
    // フィルタ ON 中にお気に入り解除された作品2は即座に一覧から消去されること
    await expect(page.getByTestId("novel-card")).toHaveCount(1);
    await expect(
      page.getByTestId("novel-card").nth(0).getByTestId("novel-card-title"),
    ).toHaveText("境界迷宮と異界の魔術師");

    // =========================================================================
    // 10. ページリロード後もお気に入りフィルタ状態が復元・維持されること（bookshelf_favorite_only 永続化）
    // =========================================================================
    await page.reload();
    await waitForServicesReady(page);

    const reloadedFavFilterBtn = page.getByTestId(
      "bookshelf-favorite-filter-button",
    );
    await expect(reloadedFavFilterBtn).toBeVisible();
    await expect(reloadedFavFilterBtn).toHaveAttribute("aria-pressed", "true");

    const reloadedFavCards = page.getByTestId("novel-card");
    await expect(reloadedFavCards).toHaveCount(1);
    await expect(
      reloadedFavCards.nth(0).getByTestId("novel-card-title"),
    ).toHaveText("境界迷宮と異界の魔術師");

    // =========================================================================
    // 11. お気に入りフィルタ ON 中にお気に入りを解除して 0 件になった際の bookshelf-favorite-empty 描画と、「すべての作品を表示」押下による全作品再表示 (AC-BS-15, TR-16)
    // =========================================================================
    // 残る1件（作品1）のお気に入りボタンをクリックして解除
    const lastFavCard = page.getByTestId("novel-card").nth(0);
    await lastFavCard.getByTestId("novel-card-favorite-button").click();

    // お気に入り該当作品が 0 件になり、専用空状態 bookshelf-favorite-empty が表示されること
    const favEmptyState = page.getByTestId("bookshelf-favorite-empty");
    await expect(favEmptyState).toBeVisible();
    await expect(favEmptyState).toContainText(
      "お気に入り登録された作品がありません",
    );

    // 通常の未登録空状態（bookshelf-empty）や作品リストは描画されないこと
    await expect(page.getByTestId("bookshelf-empty")).toHaveCount(0);
    await expect(page.getByTestId("novel-list")).toHaveCount(0);

    // 「すべての作品を表示」（empty-clear-favorite-filter-button）ボタンが表示されていること
    const clearFilterBtn = page.getByTestId(
      "empty-clear-favorite-filter-button",
    );
    await expect(clearFilterBtn).toBeVisible();
    await expect(clearFilterBtn).toHaveText("すべての作品を表示");

    // 「すべての作品を表示」をクリックしてフィルタ解除
    await clearFilterBtn.click();

    // お気に入りフィルタボタンが aria-pressed="false" になり、全2作品が再表示されること
    await expect(reloadedFavFilterBtn).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("novel-card")).toHaveCount(2);

    // リロード後もフィルタ解除状態が維持されていることを確認
    await page.reload();
    await waitForServicesReady(page);
    await expect(
      page.getByTestId("bookshelf-favorite-filter-button"),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("novel-card")).toHaveCount(2);

    // =========================================================================
    // 12. お気に入りフィルタ ON 時の手動「更新」ボタン押下でお気に入り作品のみが更新対象となること (AC-BS-10, TR-17)
    // =========================================================================
    // 両作品の last_checked_at を過去の同一時刻（3時間前）にリセット
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    await page.evaluate(async (pastTime) => {
      const services = window.__yommyServices!;
      await services.databaseAdapter.execute(
        "UPDATE novels SET last_checked_at = ?",
        [pastTime],
      );
    }, threeHoursAgo);

    // 作品1をお気に入りに登録
    const cardWork1ForUpdate = page
      .getByTestId("novel-card")
      .filter({ hasText: "境界迷宮と異界の魔術師" });
    await cardWork1ForUpdate.getByTestId("novel-card-favorite-button").click();
    await expect(
      cardWork1ForUpdate.getByTestId("novel-card-favorite-button"),
    ).toHaveAttribute("aria-pressed", "true");

    // お気に入りフィルタを ON にする（作品1のみ表示、作品2は非お気に入り）
    const updateFavFilterBtn = page.getByTestId(
      "bookshelf-favorite-filter-button",
    );
    await updateFavFilterBtn.click();
    await expect(updateFavFilterBtn).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("novel-card")).toHaveCount(1);

    // 手動更新ボタンを押下（お気に入りフィルタ ON 時は表示中のお気に入り1作品のみ対象: AC-BS-10, R2-06）
    // 1件更新時の進捗表示（総件数が1件であること）およびボタン disabled 遷移を決定論的に捕捉するため、httpClient.getHtml に軽微な遅延を挟む
    await page.evaluate(() => {
      const services = window.__yommyServices!;
      const client = services.httpClient as unknown as {
        getHtml: (options: { url: string }) => Promise<unknown>;
      };
      const origGetHtml = client.getHtml.bind(client);
      client.getHtml = async (options: { url: string }) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return origGetHtml(options);
      };
    });

    const favRefreshBtn = page.getByTestId("bookshelf-refresh-button");
    const favRefreshProgress = page.getByTestId("bookshelf-refresh-progress");
    await expect(favRefreshBtn).toBeEnabled();
    await favRefreshBtn.click();

    // 更新実行中は進捗表示に総件数 1 件（"(0/1)" または "(1/1)"）が表示され、更新ボタンが無効化されることを確認 (R2-06)
    await expect(favRefreshProgress).toBeVisible();
    await expect(favRefreshProgress).toContainText(/\/1\)/);
    await expect(favRefreshBtn).toBeDisabled();

    // expect.poll で作品1（お気に入り・表示中）の last_checked_at が更新されることをポーリング待機 (R1-14, R2-06)
    await expect
      .poll(
        async () => {
          return await page.evaluate(async () => {
            const services = window.__yommyServices!;
            const rows = await services.databaseAdapter.query<{
              id: string;
              last_checked_at: string;
            }>("SELECT id, last_checked_at FROM novels ORDER BY id");
            const work1 = rows.find(
              (r) => r.id === "kakuyomu:16817330658027210412",
            );
            if (!work1) return -1;
            return Date.now() - new Date(work1.last_checked_at).getTime();
          });
        },
        { timeout: 15000 },
      )
      .toBeLessThan(30000);

    // 更新処理が完全に終了して進捗表示が非表示となり、更新ボタンが再活性化されたことを確認してから作品2の否定アサーションを行う (TR-17, R2-06)
    await expect(favRefreshProgress).not.toBeVisible({ timeout: 15000 });
    await expect(favRefreshBtn).toBeEnabled({ timeout: 15000 });

    const checkedRows = await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const rows = await services.databaseAdapter.query<{
        id: string;
        last_checked_at: string;
      }>("SELECT id, last_checked_at FROM novels ORDER BY id");
      return rows;
    });

    const work1Row = checkedRows.find(
      (r) => r.id === "kakuyomu:16817330658027210412",
    );
    const work2Row = checkedRows.find(
      (r) => r.id === "kakuyomu:16817330658027210002",
    );

    expect(work1Row).toBeTruthy();
    expect(work2Row).toBeTruthy();

    // 作品1は更新された（30秒以内）
    const work1Time = new Date(work1Row!.last_checked_at).getTime();
    expect(Date.now() - work1Time).toBeLessThan(30000);

    // 作品2は更新対象外（3時間前のまま変化なし）
    expect(work2Row!.last_checked_at).toBe(threeHoursAgo);
  });
});

test.describe("SCN-03 (Issue #375): 最新話末尾しおり時の新着話更新に伴うしおり自動進行 E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForServicesReady(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForServicesReady(page);
  });

  test("本棚手動更新チェックでの短文1ページ完了→末尾自動進行＆途中しおり維持＆「第N話から読む」起動", async ({
    page,
  }) => {
    const work1Id = "kakuyomu:16817330658027210412";
    const work2Id = "kakuyomu:16817330658027210002";

    // 1. 2作品を初期2話のみでシード登録（last_checked_at = now で自動更新の先行発火を抑止）
    await page.evaluate(
      async ({ w1Id, w2Id }) => {
        const services = window.__yommyServices!;
        const nowIso = new Date().toISOString();

        const url1 = "https://kakuyomu.jp/works/16817330658027210412";
        const res1 = await services.httpClient.getHtml({ url: url1 });
        const parser1 = services.parserRegistry.requireParser(url1);
        const parsed1 = parser1.parseNovelIndex(res1.html, url1);
        await services.novelRepository.upsertNovelWithToc(
          {
            ...parsed1,
            chapters: parsed1.chapters.slice(0, 2),
          },
          nowIso,
        );

        const shortBodyHtml = "<p>短い第2話の本文です。</p>";
        await services.chapterRepository.saveChapterBody(
          w1Id,
          2,
          {
            remoteChapterId: parsed1.chapters[1].remoteChapterId,
            title: parsed1.chapters[1].title,
            bodyHtml: shortBodyHtml,
            byteSize: new TextEncoder().encode(shortBodyHtml).length,
            prevChapterUrl: parsed1.chapters[0].url,
            nextChapterUrl: null,
          },
          nowIso,
        );
        await services.chapterRepository.markChapterRead(w1Id, 1, true);
        await services.chapterRepository.markChapterRead(w1Id, 2, true);
        await services.novelRepository.updateBookmark(w1Id, 2, 0);

        const url2 = "https://kakuyomu.jp/works/16817330658027210002";
        const res2 = await services.httpClient.getHtml({ url: url2 });
        const parser2 = services.parserRegistry.requireParser(url2);
        const parsed2 = parser2.parseNovelIndex(res2.html, url2);
        await services.novelRepository.upsertNovelWithToc(
          {
            ...parsed2,
            chapters: parsed2.chapters.slice(0, 2),
          },
          nowIso,
        );
        await services.chapterRepository.markChapterRead(w2Id, 1, true);
        await services.novelRepository.updateBookmark(w2Id, 2, 0.5);
      },
      { w1Id: work1Id, w2Id: work2Id },
    );

    // 2. 作品1の第2話（1ページ短文）をリーダーで開き、自動完了保存（bookmarkScrollProgress >= 0.99）を確認
    await page.goto(`/novels/${encodeURIComponent(work1Id)}/chapters/2`);
    await waitForServicesReady(page);

    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "paged",
    );
    await expect(readerView).toHaveAttribute("data-total-pages", "1");
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    await expect
      .poll(
        async () => {
          return await page.evaluate(async (id) => {
            const novel =
              await window.__yommyServices!.novelRepository.getNovelById(id);
            return {
              bookmarkChapterIndex: novel?.bookmarkChapterIndex ?? null,
              bookmarkScrollProgress: novel?.bookmarkScrollProgress ?? 0,
            };
          }, work1Id);
        },
        { timeout: 10000 },
      )
      .toEqual({
        bookmarkChapterIndex: 2,
        bookmarkScrollProgress: 1,
      });

    // 3. リーダー下部オーバーレイから本棚（/）へ戻り、更新前のしおり表示を確認
    await page.getByTestId("reader-bottom-touch-zone").click();
    const bookshelfTab = page.getByTestId("reader-bottom-tab-bookshelf");
    await expect(bookshelfTab).toBeVisible();
    await bookshelfTab.click();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();
    await expect(page.getByTestId("novel-card")).toHaveCount(2);

    const work1Card = page
      .getByTestId("novel-card")
      .filter({ hasText: "境界迷宮と異界の魔術師" });
    const work2Card = page
      .getByTestId("novel-card")
      .filter({ hasText: "あいうえおの冒険" });

    await expect(work1Card.getByTestId("novel-card-bookmark")).toHaveText(
      "しおり: 第2話",
    );
    await expect(work1Card.getByTestId("novel-card-resume")).toHaveText(
      "第2話から読む",
    );
    await expect(work2Card.getByTestId("novel-card-bookmark")).toHaveText(
      "しおり: 第2話",
    );
    await expect(work2Card.getByTestId("novel-card-resume")).toHaveText(
      "第2話から読む",
    );

    // 更新前の lastReadAt / updatedAt を記録（自動進行時の保護検証用）
    const preRefreshMeta = await page.evaluate(
      async ({ w1Id, w2Id }) => {
        const services = window.__yommyServices!;
        const n1 = await services.novelRepository.getNovelById(w1Id);
        const n2 = await services.novelRepository.getNovelById(w2Id);
        return {
          w1LastReadAt: n1?.lastReadAt ?? null,
          w1UpdatedAt: n1?.updatedAt ?? null,
          w2LastReadAt: n2?.lastReadAt ?? null,
          w2UpdatedAt: n2?.updatedAt ?? null,
        };
      },
      { w1Id: work1Id, w2Id: work2Id },
    );
    expect(preRefreshMeta.w1LastReadAt).not.toBeNull();
    expect(preRefreshMeta.w1UpdatedAt).not.toBeNull();

    // 4. 手動一括更新チェック（MockHttpClient の全4話目次を取り込む）
    const refreshBtn = page.getByTestId("bookshelf-refresh-button");
    await expect(refreshBtn).toBeEnabled();
    await refreshBtn.click();

    await expect(
      page.getByTestId("bookshelf-refresh-progress"),
    ).not.toBeVisible({ timeout: 15000 });
    await expect(refreshBtn).toBeEnabled({ timeout: 15000 });

    await expect
      .poll(
        async () => {
          return await page.evaluate(
            async ({ w1Id, w2Id }) => {
              const services = window.__yommyServices!;
              const n1 = await services.novelRepository.getNovelById(w1Id);
              const n2 = await services.novelRepository.getNovelById(w2Id);
              return {
                w1Total: n1?.totalChapters ?? 0,
                w2Total: n2?.totalChapters ?? 0,
              };
            },
            { w1Id: work1Id, w2Id: work2Id },
          );
        },
        { timeout: 15000 },
      )
      .toEqual({ w1Total: 4, w2Total: 4 });

    // 5. UI と DB で作品1のしおり自動進行（第3話・progress=0・lastReadAt/updatedAt 保護・Ch3 未読）および作品2の途中しおり維持（第2話・0.5）を検証
    await expect(work1Card.getByTestId("novel-card-new-badge")).toHaveText(
      "NEW",
    );
    await expect(work1Card.getByTestId("novel-card-bookmark")).toHaveText(
      "しおり: 第3話",
    );
    await expect(work1Card.getByTestId("novel-card-resume")).toHaveText(
      "第3話から読む",
    );

    await expect(work2Card.getByTestId("novel-card-bookmark")).toHaveText(
      "しおり: 第2話",
    );
    await expect(work2Card.getByTestId("novel-card-resume")).toHaveText(
      "第2話から読む",
    );

    const postRefreshState = await page.evaluate(
      async ({ w1Id, w2Id }) => {
        const services = window.__yommyServices!;
        const n1 = await services.novelRepository.getNovelById(w1Id);
        const n2 = await services.novelRepository.getNovelById(w2Id);
        const ch3 = await services.chapterRepository.getChapter(w1Id, 3);
        return {
          w1Bookmark: n1?.bookmarkChapterIndex ?? null,
          w1Progress: n1?.bookmarkScrollProgress ?? -1,
          w1LastReadAt: n1?.lastReadAt ?? null,
          w1UpdatedAt: n1?.updatedAt ?? null,
          w1Ch3IsRead: ch3?.isRead ?? null,
          w2Bookmark: n2?.bookmarkChapterIndex ?? null,
          w2Progress: n2?.bookmarkScrollProgress ?? -1,
          w2LastReadAt: n2?.lastReadAt ?? null,
          w2UpdatedAt: n2?.updatedAt ?? null,
        };
      },
      { w1Id: work1Id, w2Id: work2Id },
    );

    expect(postRefreshState).toEqual({
      w1Bookmark: 3,
      w1Progress: 0,
      w1LastReadAt: preRefreshMeta.w1LastReadAt,
      w1UpdatedAt: preRefreshMeta.w1UpdatedAt,
      w1Ch3IsRead: false,
      w2Bookmark: 2,
      w2Progress: 0.5,
      w2LastReadAt: preRefreshMeta.w2LastReadAt,
      w2UpdatedAt: preRefreshMeta.w2UpdatedAt,
    });

    // 6. 作品1の「第3話から読む」押下で新着第3話の先頭（1ページ目）から開き、既読化されることを検証
    await work1Card.getByTestId("novel-card-resume").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/3$/,
    );
    await expect(readerView).toBeVisible();
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第2話 初めての魔法",
    );
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    await expect
      .poll(
        async () => {
          return await page.evaluate(async (w1Id) => {
            const ch3 =
              await window.__yommyServices!.chapterRepository.getChapter(
                w1Id,
                3,
              );
            return ch3?.isRead ?? false;
          }, work1Id);
        },
        { timeout: 10000 },
      )
      .toBe(true);
  });

  test("作品詳細画面（SCR-02）目次更新での自動進行・しおりバッジ移動・既読/未読整合確認", async ({
    page,
  }) => {
    const novelId = "kakuyomu:16817330658027210001";

    // 1. 2話のみでシード登録し、第1・2話既読・第2話末尾しおり（progress=1.0）を設定
    const preRefreshMeta = await page.evaluate(async (id) => {
      const services = window.__yommyServices!;
      const nowIso = new Date().toISOString();
      const workUrl = "https://kakuyomu.jp/works/16817330658027210001";
      const res = await services.httpClient.getHtml({ url: workUrl });
      const parser = services.parserRegistry.requireParser(workUrl);
      const parsed = parser.parseNovelIndex(res.html, workUrl);
      await services.novelRepository.upsertNovelWithToc(
        {
          ...parsed,
          chapters: parsed.chapters.slice(0, 2),
        },
        nowIso,
      );
      await services.chapterRepository.markChapterRead(id, 1, true);
      await services.chapterRepository.markChapterRead(id, 2, true);
      await services.novelRepository.updateBookmark(id, 2, 1.0);
      const novel = await services.novelRepository.getNovelById(id);
      return {
        lastReadAt: novel?.lastReadAt ?? null,
        updatedAt: novel?.updatedAt ?? null,
      };
    }, novelId);

    expect(preRefreshMeta.lastReadAt).not.toBeNull();
    expect(preRefreshMeta.updatedAt).not.toBeNull();

    // 2. 作品詳細画面（SCR-02）を開く
    await page.goto(`/novels/${encodeURIComponent(novelId)}`);
    await waitForServicesReady(page);

    await expect(page.getByTestId("novel-detail-title")).toHaveText(
      "転生令嬢の異世界冒険譚",
    );
    const resumeButton = page.getByTestId("detail-resume-button");
    await expect(resumeButton).toHaveText("続きから読む（第2話）");

    const episodeItems = page.getByTestId("episode-item");
    await expect(episodeItems).toHaveCount(2);
    await expect(
      episodeItems.nth(0).getByTestId("episode-bookmark-badge"),
    ).toHaveCount(0);
    await expect(
      episodeItems.nth(1).getByTestId("episode-bookmark-badge"),
    ).toBeVisible();
    await expect(
      episodeItems.nth(1).getByTestId("episode-read-badge"),
    ).toBeVisible();

    // 3. リロードなしで目次更新ボタン（refresh-toc-button）を押下
    await page.getByTestId("refresh-toc-button").click();

    await expect(page.getByTestId("novel-detail-notice")).toHaveText(
      "目次を更新しました（+2話）",
    );
    await expect(episodeItems).toHaveCount(4);
    await expect(resumeButton).toHaveText("続きから読む（第3話）");

    // しおりバッジが第3話（未読）へ移動し、第2話は既読のまましおりバッジが外れること
    await expect(
      episodeItems.nth(1).getByTestId("episode-bookmark-badge"),
    ).toHaveCount(0);
    await expect(
      episodeItems.nth(1).getByTestId("episode-read-badge"),
    ).toBeVisible();
    await expect(
      episodeItems.nth(2).getByTestId("episode-bookmark-badge"),
    ).toBeVisible();
    await expect(
      episodeItems.nth(2).getByTestId("episode-read-badge"),
    ).toHaveCount(0);

    const postRefreshDb = await page.evaluate(async (id) => {
      const services = window.__yommyServices!;
      const novel = await services.novelRepository.getNovelById(id);
      const ch3 = await services.chapterRepository.getChapter(id, 3);
      return {
        bookmarkChapterIndex: novel?.bookmarkChapterIndex ?? null,
        bookmarkScrollProgress: novel?.bookmarkScrollProgress ?? -1,
        lastReadAt: novel?.lastReadAt ?? null,
        updatedAt: novel?.updatedAt ?? null,
        ch3IsRead: ch3?.isRead ?? null,
      };
    }, novelId);

    expect(postRefreshDb).toEqual({
      bookmarkChapterIndex: 3,
      bookmarkScrollProgress: 0,
      lastReadAt: preRefreshMeta.lastReadAt,
      updatedAt: preRefreshMeta.updatedAt,
      ch3IsRead: false,
    });

    // 4. 目次一覧から第2話を直接タップすると第2話の先頭から正常に開けること
    await episodeItems.nth(1).click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210001\/chapters\/2$/,
    );
    await expect(page.getByTestId("reader-view")).toBeVisible();
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );
    await expect(page.getByTestId("reader-view")).toHaveAttribute(
      "data-current-page",
      "1",
    );
  });

  test("連続スクロール（scroll）モードでの5px端丸め・短文1画面自動完了・完了済み再表示時のlastReadAt保護（AC-RD-36 / AC-RD-34）", async ({
    page,
  }) => {
    const novelId = "kakuyomu:16817330658027210412";

    // 1. 連続スクロール設定（pagingMode: "scroll", writingMode: "horizontal-tb"）へ更新し、
    //    長文（第1話）と1画面短文（第2話）の2話構成で作品をシード
    await page.evaluate(async (id) => {
      const services = window.__yommyServices!;
      await services.settingsRepository.updateReaderSettings({
        pagingMode: "scroll",
        writingMode: "horizontal-tb",
      });

      const workUrl = "https://kakuyomu.jp/works/16817330658027210412";
      const nowIso = new Date().toISOString();
      const indexRes = await services.httpClient.getHtml({ url: workUrl });
      const parser = services.parserRegistry.requireParser(workUrl);
      const parsedIndex = parser.parseNovelIndex(indexRes.html, workUrl);

      await services.novelRepository.upsertNovelWithToc(
        {
          ...parsedIndex,
          chapters: parsedIndex.chapters.slice(0, 2),
        },
        nowIso,
      );

      // 第1話: 確実に垂直スクロールが発生する長文を保存
      const ch1Res = await services.httpClient.getHtml({
        url: parsedIndex.chapters[0].url,
      });
      const parsedCh1 = parser.parseChapterContent(
        ch1Res.html,
        parsedIndex.chapters[0].url,
      );
      const longBodyHtml = `${parsedCh1.bodyHtml}\n${parsedCh1.bodyHtml}\n${parsedCh1.bodyHtml}`;
      await services.chapterRepository.saveChapterBody(
        id,
        1,
        {
          ...parsedCh1,
          bodyHtml: longBodyHtml,
          byteSize: new TextEncoder().encode(longBodyHtml).length,
        },
        nowIso,
      );

      // 第2話: 1画面内に収まる短文（maxScroll <= 0）を保存
      const shortBodyHtml = "<p>短い第2話の本文です。</p>";
      await services.chapterRepository.saveChapterBody(
        id,
        2,
        {
          remoteChapterId: parsedIndex.chapters[1].remoteChapterId,
          title: parsedIndex.chapters[1].title,
          bodyHtml: shortBodyHtml,
          byteSize: new TextEncoder().encode(shortBodyHtml).length,
          prevChapterUrl: parsedIndex.chapters[0].url,
          nextChapterUrl: null,
        },
        nowIso,
      );

      await services.novelRepository.updateBookmark(id, 1, 0);
    }, novelId);

    // 2. 第1話（scroll モード長文）を開き、最下部 5px 以内到達（0 < maxScroll - currentScroll <= 5）で progress=1.0 へ丸め保存されること
    await page.goto(`/novels/${encodeURIComponent(novelId)}/chapters/1`);
    await waitForServicesReady(page);

    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "scroll",
    );
    await expect(readerView).toHaveAttribute(
      "data-writing-mode",
      "horizontal-tb",
    );
    await expect(page.getByTestId("reader-chapter-title")).toBeVisible();

    await expect
      .poll(
        async () =>
          readerView.evaluate((el) => el.scrollHeight - el.clientHeight),
        { timeout: 10000 },
      )
      .toBeGreaterThan(20);

    // 初期復元 rAF 完了を待ってから、maxScroll - 3px 地点へスクロールして scroll イベントを発火
    const snappedDelta = await readerView.evaluate(async (el) => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTop = maxScroll - 3;
      const currentScroll = el.scrollTop;
      el.dispatchEvent(new Event("scroll"));
      return maxScroll - currentScroll;
    });
    expect(snappedDelta).toBeGreaterThan(0);
    expect(snappedDelta).toBeLessThanOrEqual(5);

    await expect
      .poll(
        async () =>
          page.evaluate(async (id) => {
            const novel =
              await window.__yommyServices!.novelRepository.getNovelById(id);
            return {
              bookmarkChapterIndex: novel?.bookmarkChapterIndex ?? null,
              bookmarkScrollProgress: novel?.bookmarkScrollProgress ?? -1,
            };
          }, novelId),
        { timeout: 10000 },
      )
      .toEqual({
        bookmarkChapterIndex: 1,
        bookmarkScrollProgress: 1,
      });

    // 3. 連続スクロールモードで第2話（1画面収まり短文: maxScroll <= 0）へ遷移し、自動で progress=1.0 が保存されること
    await page.getByTestId("reader-bottom-touch-zone").click();
    const nextChapterBtn = page.getByTestId("reader-next-chapter");
    await expect(nextChapterBtn).toBeVisible();
    await nextChapterBtn.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2$/,
    );
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "scroll",
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );
    await expect(page.getByTestId("reader-body")).toContainText(
      "短い第2話の本文です。",
    );

    const isShortSingleScreen = await readerView.evaluate(
      (el) => el.scrollHeight - el.clientHeight <= 0,
    );
    expect(isShortSingleScreen).toBe(true);

    await expect
      .poll(
        async () =>
          page.evaluate(async (id) => {
            const novel =
              await window.__yommyServices!.novelRepository.getNovelById(id);
            const ch2 =
              await window.__yommyServices!.chapterRepository.getChapter(id, 2);
            return {
              bookmarkChapterIndex: novel?.bookmarkChapterIndex ?? null,
              bookmarkScrollProgress: novel?.bookmarkScrollProgress ?? -1,
              ch2IsRead: ch2?.isRead ?? false,
            };
          }, novelId),
        { timeout: 10000 },
      )
      .toEqual({
        bookmarkChapterIndex: 2,
        bookmarkScrollProgress: 1,
        ch2IsRead: true,
      });

    // 4. 既に bookmarkScrollProgress === 1.0 が保存されている第2話を再表示しても lastReadAt が上書き更新されないこと（AC-RD-36 / AC-RD-34）
    await page.goto(`/novels/${encodeURIComponent(novelId)}`);
    await waitForServicesReady(page);
    await expect(page.getByTestId("detail-resume-button")).toHaveText(
      "続きから読む（第2話）",
    );

    const fixedLastReadAt = new Date(Date.now() - 3_600_000).toISOString();
    await page.evaluate(
      async ({ id, pastIso }) => {
        const services = window.__yommyServices!;
        await services.databaseAdapter.execute(
          "UPDATE novels SET last_read_at = ?, updated_at = ? WHERE id = ?",
          [pastIso, pastIso, id],
        );

        const win = window as Window & {
          __yommyUpdateBookmarkCalls?: number;
        };
        win.__yommyUpdateBookmarkCalls = 0;
        const originalUpdateBookmark =
          services.novelRepository.updateBookmark.bind(
            services.novelRepository,
          );
        services.novelRepository.updateBookmark = async (
          targetId,
          chapterIndex,
          scrollProgress,
        ) => {
          win.__yommyUpdateBookmarkCalls =
            (win.__yommyUpdateBookmarkCalls ?? 0) + 1;
          return originalUpdateBookmark(targetId, chapterIndex, scrollProgress);
        };
      },
      { id: novelId, pastIso: fixedLastReadAt },
    );

    // 「続きから読む（第2話）」で第2話を再表示（React Router 遷移でスパイ維持）
    await page.getByTestId("detail-resume-button").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2$/,
    );
    await expect(readerView).toBeVisible();
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "scroll",
    );
    await expect(page.getByTestId("reader-body")).toContainText(
      "短い第2話の本文です。",
    );

    // DOM 計測（rAF + setTimeout(0) + document.fonts.ready）完了後に未保存であることを確認
    await readerView.evaluate(async () => {
      if (document.fonts) {
        await document.fonts.ready;
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 0)),
        );
      });
    });

    // 上部オーバーレイの「← 目次」で未操作離脱（flushBookmark 経路も含め書き込み抑止を検証）
    await page.getByTestId("reader-bottom-touch-zone").click();
    await expect(page.getByTestId("reader-top-back-to-toc")).toBeVisible();
    await page.getByTestId("reader-top-back-to-toc").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    await expect(page.getByTestId("detail-resume-button")).toHaveText(
      "続きから読む（第2話）",
    );

    const revisitResult = await page.evaluate(async (id) => {
      const win = window as Window & {
        __yommyUpdateBookmarkCalls?: number;
      };
      const novel =
        await window.__yommyServices!.novelRepository.getNovelById(id);
      return {
        updateBookmarkCalls: win.__yommyUpdateBookmarkCalls ?? -1,
        bookmarkChapterIndex: novel?.bookmarkChapterIndex ?? null,
        bookmarkScrollProgress: novel?.bookmarkScrollProgress ?? -1,
        lastReadAt: novel?.lastReadAt ?? null,
      };
    }, novelId);

    expect(revisitResult).toEqual({
      updateBookmarkCalls: 0,
      bookmarkChapterIndex: 2,
      bookmarkScrollProgress: 1,
      lastReadAt: fixedLastReadAt,
    });
  });
});
