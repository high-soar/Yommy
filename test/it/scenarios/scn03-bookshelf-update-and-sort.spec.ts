import { test, expect } from "@playwright/test";

test.describe("SCN-03: 本棚自動更新チェック・NEW表示/解除・手動一括更新・5種ソート永続化・お気に入りトグル/フィルタ/更新連動シナリオ (HO-18, HO-19, HO-32)", () => {
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
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );

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

    // 5. リーダー閲覧による NEW バッジ解除検証 (HO-18, AC-BS-09, TR-03, AC-RD-03 / AC-RD-07)
    // 作品2に NEW フラグ（has_new_update = 1）を直接設定
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      await services.databaseAdapter.execute(
        "UPDATE novels SET has_new_update = 1 WHERE id = ?",
        ["kakuyomu:16817330658027210002"],
      );
    });
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );

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
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );
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
    await expect(detailFavBtn).toHaveAttribute("aria-pressed", "false");
    await expect(detailFavBtn).toHaveText("☆ お気に入り");

    // 作品詳細ヘッダーでお気に入り登録
    await detailFavBtn.click();
    await expect(detailFavBtn).toHaveAttribute("aria-pressed", "true");
    await expect(detailFavBtn).toHaveText("★ お気に入り");

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
      "☆ お気に入り",
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
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady === true,
    );

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
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady === true,
    );
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
