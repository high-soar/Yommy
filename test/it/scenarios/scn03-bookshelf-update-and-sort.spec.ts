import { test, expect } from "@playwright/test";

test.describe("SCN-03: 本棚自動更新チェック・NEW表示/解除・手動一括更新・5種ソート永続化シナリオ (HO-18, HO-19)", () => {
  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("本棚自動更新チェック・NEWバッジ表示と詳細/リーダー遷移時解除・手動一括更新・5種ソート切替/永続化が正常に機能する", async ({
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

      // 作品1の last_checked_at を 2時間前（自動更新チェック対象: 1時間以上経過）に設定、has_new_update = 0 に設定
      const work1Id = `${parsedIndex.siteType}:${parsedIndex.remoteWorkId}`;
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      await services.databaseAdapter.execute(
        "UPDATE novels SET last_checked_at = ?, has_new_update = 0 WHERE id = ?",
        [twoHoursAgo, work1Id],
      );

      // 作品2を直接 DB に登録（50音順で作品1より前になるタイトル: "あいうえおの冒険"）
      const novel2Id = "kakuyomu:9999999999999999999";
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
          "9999999999999999999",
          "https://kakuyomu.jp/works/9999999999999999999",
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
          "https://kakuyomu.jp/works/9999999999999999999/episodes/1",
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

    // 5. リーダー閲覧による NEW バッジ解除検証 (HO-18, AC-BS-09, TR-03, AC-RD-11)
    // 作品2に NEW フラグ（has_new_update = 1）を直接設定
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      await services.databaseAdapter.execute(
        "UPDATE novels SET has_new_update = 1 WHERE id = ?",
        ["kakuyomu:9999999999999999999"],
      );
    });
    await page.reload();

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
      /\/novels\/kakuyomu(%3A|:)9999999999999999999\/chapters\/1$/,
    );
    await expect(page.getByTestId("reader-page")).toBeVisible();
    await expect(page.getByTestId("reader-view")).toBeVisible();

    // リーダー画面からブラウザ戻る操作で論理階層（作品詳細）を経て本棚へ復帰（fromBookshelfResume仕様）
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)9999999999999999999$/,
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

    // TR-17 の結果反映: 作品1の更新確認日時 (last_checked_at) が更新されていること
    const lastChecked = await page.evaluate(async () => {
      const services = window.__yommyServices!;
      const rows = await services.databaseAdapter.query<{
        last_checked_at: string;
      }>(
        "SELECT last_checked_at FROM novels WHERE id = 'kakuyomu:16817330658027210412'",
      );
      return rows[0]?.last_checked_at;
    });
    expect(lastChecked).toBeTruthy();
    const checkedTime = new Date(lastChecked!).getTime();
    expect(Date.now() - checkedTime).toBeLessThan(30000);
  });
});
