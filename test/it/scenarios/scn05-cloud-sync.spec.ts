import { test, expect } from "@playwright/test";

test.describe("SCN-05: Google Drive appDataFolder によるクラウド同期・端末間引き継ぎ・Tombstone伝播・401失効検知シナリオ", () => {
  test.setTimeout(60000);

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

  test("設定画面でのGoogle連携・端末Aでの作品閲覧とお気に入り変更自動Push・端末Bでの自動Pull復元とお気に入りLWWマージ・削除Tombstone伝播・401失効検知安全フォールバックが一連として正常に機能する", async ({
    page,
  }) => {
    // =========================================================================
    // ステップ1: 設定画面での Google アカウント連携（SCR-05）
    // =========================================================================
    // 1. 本棚から設定タブ（tab-settings）へ遷移
    const tabSettings = page.getByTestId("tab-settings");
    await expect(tabSettings).toBeVisible();
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");

    // 2. クラウド同期セクション（cloud-sync-section）が表示され、未連携状態であることを確認
    const cloudSyncSection = page.getByTestId("cloud-sync-section");
    await expect(cloudSyncSection).toBeVisible();

    const syncStatus = page.getByTestId("cloud-sync-status");
    await expect(syncStatus).toContainText("未連携");

    const authButton = page.getByTestId("cloud-sync-auth-button");
    await expect(authButton).toBeVisible();
    await expect(authButton).toHaveText("Google アカウントと連携");

    // 3. 「Google アカウントと連携」ボタンをクリック
    await authButton.click();

    // 4. 連携中表示に切り替わり、アカウントメールアドレス（test-user@example.com）および
    //    「今すぐ同期」ボタン、連携解除ボタンが表示されることを確認
    await expect(syncStatus).toContainText("test-user@example.com");
    const syncNowButton = page.getByTestId("cloud-sync-now-button");
    const disconnectButton = page.getByTestId("cloud-sync-disconnect-button");
    await expect(syncNowButton).toBeVisible();
    await expect(disconnectButton).toBeVisible();

    // =========================================================================
    // ステップ2: 端末 A での作品登録・リーダー閲覧（第2話しおり進行）と自動 Push
    // =========================================================================
    // 1. 本棚タブへ戻る
    const tabBookshelf = page.getByTestId("tab-bookshelf");
    await tabBookshelf.click();
    await expect(page).toHaveURL("/");

    // 2. 共通サービス（window.__yommyServices）を用いてサンプル作品をシード登録
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );
    await page.evaluate(async () => {
      const services = window.__yommyServices!;
      // カクヨム作品のシード登録
      const sampleUrl = "https://kakuyomu.jp/works/16817330658027210412";
      const response = await services.httpClient.getHtml({ url: sampleUrl });
      const parser = services.parserRegistry.requireParser(sampleUrl);
      const parsedIndex = parser.parseNovelIndex(response.html, sampleUrl);
      await services.novelRepository.upsertNovelWithToc(
        parsedIndex,
        new Date().toISOString(),
      );

      // 小説家になろう作品のシード登録（複数ページ目次取得・クラウド同期検証, Issue #239, R1-06）
      const narouUrl = "https://ncode.syosetu.com/n9669bk/";
      const narouParser = services.parserRegistry.requireParser(narouUrl);
      const parsedIndexNarou = await services.fetchFullNovelIndex!(
        services.httpClient,
        narouParser,
        narouUrl,
      );
      await services.novelRepository.upsertNovelWithToc(
        parsedIndexNarou,
        new Date().toISOString(),
      );
      // なろう作品の第4話しおり・既読設定
      await services.novelRepository.updateBookmark("narou:n9669bk", 4, 0.0);
      await services.chapterRepository.markChapterRead(
        "narou:n9669bk",
        4,
        true,
      );
    });
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady === true,
    );

    // 3. 本棚にカクヨムおよびなろうの2作品カードが表示されていることを確認
    const novelCards = page.getByTestId("novel-card");
    await expect(novelCards).toHaveCount(2);
    await expect(page.getByText("境界迷宮と異界の魔術師")).toBeVisible();
    await expect(
      page.getByText("無職転生 - 異世界行ったら本気だす"),
    ).toBeVisible();

    // 4. カクヨム作品カード上でお気に入り（★）を登録（AC-BS-14）
    const kakuyomuCard = page.locator('[data-testid="novel-card"]', {
      hasText: "境界迷宮と異界の魔術師",
    });
    const kakuyomuFavBtn = kakuyomuCard.getByTestId(
      "novel-card-favorite-button",
    );
    await expect(kakuyomuFavBtn).toBeVisible();
    await expect(kakuyomuFavBtn).toHaveAttribute("aria-pressed", "false");
    await kakuyomuFavBtn.click();
    await expect(kakuyomuFavBtn).toHaveAttribute("aria-pressed", "true");

    // 5. カクヨム作品カードをクリックして作品詳細（SCR-02）へ遷移
    const kakuyomuCardSelect = kakuyomuCard.getByTestId("novel-card-select");
    await kakuyomuCardSelect.click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    // 作品詳細ヘッダーでお気に入り状態が「★ お気に入り済み」に反映されていることを確認 (AC-ND-23)
    const detailFavBtn = page.getByTestId("detail-favorite-toggle-button");
    await expect(detailFavBtn).toBeVisible();
    await expect(detailFavBtn).toHaveAttribute("aria-pressed", "true");
    await expect(detailFavBtn).toHaveText("★ お気に入り済み");

    // 6. 目次一覧から第2話エピソード行を選択して第2話へ進む（SCR-03）
    const episodeItems = page.getByTestId("episode-item");
    await expect(episodeItems).toHaveCount(4);
    await episodeItems.nth(1).click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();

    const ch2Title = page.getByTestId("reader-chapter-title");
    await expect(ch2Title).toBeVisible();
    await expect(ch2Title).toHaveText("第1話 見知らぬ空");

    // 7. リーダーでスクロールし、第2話のしおり進捗を保存
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="reader-view"]');
      if (el) {
        el.scrollLeft = -100;
        el.dispatchEvent(new Event("scroll"));
      }
    });

    // 8. ブラウザ戻る操作で作品詳細へ戻る
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    const resumeButton = page.getByTestId("detail-resume-button");
    await expect(resumeButton).toBeVisible();
    await expect(resumeButton).toContainText("続きから読む（第2話）");

    // 9. 2.5秒のデバウンス auto-push が発火し、モック Drive のリモートデータにカクヨム（isFavorite: 1, 第2話しおり）およびなろう作品（isFavorite: 0, 第4話しおり）が記録されるのを待機 (AC-BS-13, AC-BS-14)
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("yommy_mock_gdrive_file");
        if (!raw) return false;
        try {
          const parsed = JSON.parse(raw);
          const kakuyomuNovel =
            parsed?.novels?.["kakuyomu:16817330658027210412"];
          const narouNovel = parsed?.novels?.["narou:n9669bk"];
          return (
            Boolean(kakuyomuNovel) &&
            kakuyomuNovel.bookmarkChapterIndex === 2 &&
            kakuyomuNovel.isFavorite === 1 &&
            typeof kakuyomuNovel.updatedAt === "string" &&
            kakuyomuNovel.title === "境界迷宮と異界の魔術師" &&
            Boolean(narouNovel) &&
            narouNovel.bookmarkChapterIndex === 4 &&
            narouNovel.isFavorite === 0 &&
            typeof narouNovel.updatedAt === "string" &&
            narouNovel.title === "無職転生 - 異世界行ったら本気だす"
          );
        } catch {
          return false;
        }
      },
      { timeout: 10000 },
    );

    // =========================================================================
    // ステップ3: 端末 B（DB リセット状態）での起動時自動 Pull、複数ページ目次を含むなろう作品およびカクヨム作品の自動取得、しおり復帰・既読同期確認
    // =========================================================================
    // 1. 直前の DB 永続化（onUpdate -> backup）の完了を確実に待機してからバックアップを退避（R1-19, R2-08 偽陽性防止）
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem("yommy_sqlite_db_backup")),
      )
      .not.toBeNull();
    const terminalABackup = await page.evaluate(() =>
      localStorage.getItem("yommy_sqlite_db_backup"),
    );
    expect(terminalABackup).not.toBeNull();

    // 2. 端末 B をシミュレート: 端末ローカル SQLite DB バックアップのみ削除して空にし、
    //    モック Google 連携状態およびクラウドファイル（yommy_mock_gdrive_*）は維持
    await page.evaluate(() => {
      localStorage.removeItem("yommy_sqlite_db_backup");
    });

    // 3. 本棚（/）を開く（起動時マウントフック useBookshelf による自動 Pull が実行される）
    await page.goto("/");

    // 偽陽性防止（R1-19）: 端末 B が最初は空本棚から開始することを確認
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();

    // 4. SyncEngine がリモートの作品を検知し、HttpClient 経由で目次（なろうは2ページ分全5話）を取得してローカル DB に登録し、
    //    本棚画面に2作品カードが表示されることを確認
    const novelCardsB = page.getByTestId("novel-card");
    await expect(novelCardsB).toHaveCount(2, { timeout: 15000 });

    const kakuyomuCardB = page.locator('[data-testid="novel-card"]', {
      hasText: "境界迷宮と異界の魔術師",
    });
    const narouCardB = page.locator('[data-testid="novel-card"]', {
      hasText: "無職転生 - 異世界行ったら本気だす",
    });
    await expect(kakuyomuCardB).toBeVisible();
    await expect(narouCardB).toBeVisible();

    // 厳密なしおり表記完全一致アサーション（R1-25(9)）
    await expect(kakuyomuCardB.getByTestId("novel-card-bookmark")).toHaveText(
      "しおり: 第2話",
    );
    await expect(narouCardB.getByTestId("novel-card-bookmark")).toHaveText(
      "しおり: 第4話",
    );

    // リモートからの初回 Pull でのお気に入り状態反映を検証 (AC-BS-13, AC-BS-14)
    await expect(
      kakuyomuCardB.getByTestId("novel-card-favorite-button"),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      narouCardB.getByTestId("novel-card-favorite-button"),
    ).toHaveAttribute("aria-pressed", "false");

    // 5. なろう作品カードをクリックして作品詳細へ遷移（複数ページ目次の全話復元および既読同期を検証）
    await narouCardB.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(/\/novels\/narou(%3A|:)n9669bk$/);

    // 複数ページ目次連続取得により全5話が登録されていることを確認
    const epItemsNarou = page.getByTestId("episode-item");
    await expect(epItemsNarou).toHaveCount(5);

    // 端末 A で同期された第4話（0-indexed で 3番目）に既読バッジが表示されていることを確認
    await expect(
      epItemsNarou.nth(3).getByTestId("episode-read-badge"),
    ).toBeVisible();

    // 「続きから読む（第4話）」ボタンが表示され、第4話から再開できることを確認
    const resumeButtonNarou = page.getByTestId("detail-resume-button");
    await expect(resumeButtonNarou).toBeVisible();
    await expect(resumeButtonNarou).toContainText("続きから読む（第4話）");
    await resumeButtonNarou.click();

    await expect(page).toHaveURL(/\/novels\/narou(%3A|:)n9669bk\/chapters\/4/);
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第3話 家庭教師",
    );

    // なろう作品の縦書き組版・前書き・後書き・ルビ・傍点の描画確認 (R1-02, AC-NR-06, AC-NR-07)
    await expect(
      page.locator('[data-writing-mode="vertical-rl"]'),
    ).toBeVisible();
    const readerContentNarou = page.getByTestId("reader-content");
    await expect(readerContentNarou).toBeVisible();
    await expect(readerContentNarou).toContainText("これは前書きです。");
    await expect(readerContentNarou).toContainText("────────────");
    await expect(readerContentNarou).toContainText(
      "読んでいただきありがとうございました。",
    );
    await expect(page.locator("ruby rt", { hasText: "まほう" })).toBeVisible();
    await expect(page.locator("em.bouten")).toHaveCount(3);

    // リーダーから作品詳細へ戻り、さらに本棚へ戻る
    await page.goBack();
    await expect(page).toHaveURL(/\/novels\/narou(%3A|:)n9669bk$/);
    await page.goBack();
    await expect(page).toHaveURL("/");

    // 6. カクヨム作品カードをクリックして作品詳細へ遷移（カクヨム側の検証）
    const kakuyomuCardSelectB = page
      .locator('[data-testid="novel-card"]', {
        hasText: "境界迷宮と異界の魔術師",
      })
      .getByTestId("novel-card-select");
    await kakuyomuCardSelectB.click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    // 既読バッジ同期復元の検証（R1-31, AC-RD-03 / AC-RD-07）: 端末 A で閲覧した第2話に既読バッジが表示されていることを確認
    const epItemsKakuyomu = page.getByTestId("episode-item");
    await expect(epItemsKakuyomu).toHaveCount(4);
    await expect(
      epItemsKakuyomu.nth(1).getByTestId("episode-read-badge"),
    ).toBeVisible();

    // 「続きから読む（第2話）」ボタンが表示され、第2話から再開できることを確認
    const resumeButtonKakuyomu = page.getByTestId("detail-resume-button");
    await expect(resumeButtonKakuyomu).toBeVisible();
    await expect(resumeButtonKakuyomu).toContainText("続きから読む（第2話）");
    await resumeButtonKakuyomu.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );

    // =========================================================================
    // ステップ3.5: 既存作品に対するリモート側のお気に入り変更（新しい updatedAt）のローカルへの Pull（LWW）反映検証 (AC-BS-13, AC-ND-23)
    // =========================================================================
    // 1. リーダーから目次を経て本棚へ復帰
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-page")).toBeVisible();

    // 2. 他端末によるリモート側の同期データ更新をシミュレート
    //    ・なろう作品: isFavorite を 0 → 1、updatedAt を未来時刻（現在+10秒）に設定
    //    ・カクヨム作品: isFavorite を 1 → 0、updatedAt を未来時刻（現在+10秒）に設定
    await page.evaluate(() => {
      const raw = localStorage.getItem("yommy_mock_gdrive_file");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const futureTime = new Date(Date.now() + 10000).toISOString();
      if (parsed.novels?.["narou:n9669bk"]) {
        parsed.novels["narou:n9669bk"].isFavorite = 1;
        parsed.novels["narou:n9669bk"].updatedAt = futureTime;
      }
      if (parsed.novels?.["kakuyomu:16817330658027210412"]) {
        parsed.novels["kakuyomu:16817330658027210412"].isFavorite = 0;
        parsed.novels["kakuyomu:16817330658027210412"].updatedAt = futureTime;
      }
      localStorage.setItem("yommy_mock_gdrive_file", JSON.stringify(parsed));
    });

    // 3. 設定画面へ遷移し、「今すぐ同期」を実行して Pull（LWW マージ）をトリガー
    await page.getByTestId("tab-settings").click();
    await expect(page).toHaveURL("/settings");
    const syncNowBtnStep3 = page.getByTestId("cloud-sync-now-button");
    await expect(syncNowBtnStep3).toBeVisible();
    await expect(syncNowBtnStep3).toBeEnabled();
    await syncNowBtnStep3.click();

    // 同期完了待機: 「今すぐ同期」が再活性化されることを待機 (TR-17, R1-14)
    await expect(syncNowBtnStep3).toBeEnabled({ timeout: 15000 });
    await expect(syncNowBtnStep3).toHaveText("今すぐ同期");

    // 設定画面にいる段階で、手動同期によってローカル DB の is_favorite がリモート値で更新されたことをポーリング検証 (R1-14)
    // （これにより、本棚画面への遷移時（再マウント時）の自動 Pull ではなく手動同期が正しく反映されたことを保証する）
    await expect
      .poll(
        async () => {
          return await page.evaluate(async () => {
            const services = window.__yommyServices!;
            const narou =
              await services.novelRepository.getNovelById("narou:n9669bk");
            const kakuyomu = await services.novelRepository.getNovelById(
              "kakuyomu:16817330658027210412",
            );
            return {
              narouFav: narou?.isFavorite,
              kakuyomuFav: kakuyomu?.isFavorite,
            };
          });
        },
        { timeout: 15000 },
      )
      .toEqual({
        narouFav: true,
        kakuyomuFav: false,
      });

    // 4. 本棚へ戻り、既存作品に対するリモートのお気に入り変更がローカルに反映されたことを確認
    await page.getByTestId("tab-bookshelf").click();
    await expect(page).toHaveURL("/");
    const cardKakuyomuLww = page.locator('[data-testid="novel-card"]', {
      hasText: "境界迷宮と異界の魔術師",
    });
    const cardNarouLww = page.locator('[data-testid="novel-card"]', {
      hasText: "無職転生 - 異世界行ったら本気だす",
    });

    // なろう作品が ★（aria-pressed="true"）に更新されていること
    await expect(
      cardNarouLww.getByTestId("novel-card-favorite-button"),
    ).toHaveAttribute("aria-pressed", "true");
    // カクヨム作品が ☆（aria-pressed="false"）に更新されていること
    await expect(
      cardKakuyomuLww.getByTestId("novel-card-favorite-button"),
    ).toHaveAttribute("aria-pressed", "false");

    // 5. なろう作品の詳細画面でもヘッダーのお気に入り状態が ★ に更新されていることを確認
    await cardNarouLww.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(/\/novels\/narou(%3A|:)n9669bk$/);
    const detailFavBtnNarou = page.getByTestId("detail-favorite-toggle-button");
    await expect(detailFavBtnNarou).toHaveAttribute("aria-pressed", "true");
    await expect(detailFavBtnNarou).toHaveText("★ お気に入り済み");

    // 本棚へ戻る
    await page.goBack();
    await expect(page).toHaveURL("/");

    // =========================================================================
    // ステップ4: 端末 B でのカクヨム作品削除と端末 A への Tombstone 削除伝播確認（なろう作品は維持）
    // =========================================================================
    // 1. カクヨム作品詳細画面へ遷移
    const kakuyomuCardToDelete = page.locator('[data-testid="novel-card"]', {
      hasText: "境界迷宮と異界の魔術師",
    });
    await kakuyomuCardToDelete.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    // 2. 端末 B でカクヨム作品を削除（作品詳細画面の「作品を削除」ダイアログ経由）
    const deleteButton = page.getByTestId("open-delete-dialog-button");
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const deleteDialog = page.getByTestId("delete-confirm-dialog");
    await expect(deleteDialog).toBeVisible();

    const confirmDeleteBtn = page.getByTestId("confirm-delete-button");
    await confirmDeleteBtn.click();

    // 3. 削除完了後、本棚画面（/）へ戻り、カクヨム作品のみ削除され、なろう作品カードが残っていることを確認
    await expect(page).toHaveURL("/");
    const remainingCardsB = page.getByTestId("novel-card");
    await expect(remainingCardsB).toHaveCount(1);
    await expect(
      page.getByText("無職転生 - 異世界行ったら本気だす"),
    ).toBeVisible();
    await expect(page.getByText("境界迷宮と異界の魔術師")).not.toBeVisible();

    // 4. 自動 Push によりリモートデータの deletedNovels にカクヨム作品 ID が記録され、
    //    novels になろう作品が残存しているのを待機
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("yommy_mock_gdrive_file");
        if (!raw) return false;
        try {
          const parsed = JSON.parse(raw);
          return (
            Boolean(parsed?.deletedNovels?.["kakuyomu:16817330658027210412"]) &&
            !parsed?.novels?.["kakuyomu:16817330658027210412"] &&
            Boolean(parsed?.novels?.["narou:n9669bk"])
          );
        } catch {
          return false;
        }
      },
      { timeout: 10000 },
    );

    // 5. 端末 A（端末 A の DB 状態に戻す）をシミュレート（R1-19 偽陽性防止）
    await page.evaluate((backup) => {
      localStorage.setItem("yommy_sqlite_db_backup", backup!);
    }, terminalABackup);

    // 6. ページをリロードして本棚を表示。初期化待機を確実に挟む
    await page.reload();
    await page.waitForFunction(
      () =>
        typeof window.__yommyServices !== "undefined" &&
        window.__yommyServices.isReady,
    );

    // 起動時自動 Pull によりリモートの Tombstone を検知し、
    // 端末 A のローカル DB からもカクヨム作品が削除され、なろう作品のみが残存することを確認
    const remainingCardsA = page.getByTestId("novel-card");
    await expect(remainingCardsA).toHaveCount(1, { timeout: 15000 });
    await expect(
      page.getByText("無職転生 - 異世界行ったら本気だす"),
    ).toBeVisible();
    await expect(page.getByText("境界迷宮と異界の魔術師")).not.toBeVisible();
    // 端末 A でもなろう作品のお気に入り状態（★）がリモートから LWW 反映されていること
    await expect(
      remainingCardsA.nth(0).getByTestId("novel-card-favorite-button"),
    ).toHaveAttribute("aria-pressed", "true");

    // =========================================================================
    // ステップ5: 401 遠隔認可解除検知時の安全な未連携復帰確認
    // =========================================================================
    // 1. 設定タブへ遷移
    await page.getByTestId("tab-settings").click();
    await expect(page).toHaveURL("/settings");

    // 2. モック Drive で 401 エラーをシミュレート
    await page.evaluate(() => {
      localStorage.setItem("yommy_mock_gdrive_401", "true");
    });

    // 3. 「今すぐ同期」ボタンをクリック
    const syncNowBtn = page.getByTestId("cloud-sync-now-button");
    await expect(syncNowBtn).toBeVisible();
    await syncNowBtn.click();

    // 4. 401 Unauthorized を検知し、エラー通知が表示され、未連携状態へフォールバックすることを確認
    const errorAlert = page.getByTestId("cloud-sync-error-alert");
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText("連携が解除されています");

    const reauthButton = page.getByTestId("cloud-sync-auth-button");
    await expect(reauthButton).toBeVisible();
    await expect(reauthButton).toHaveText("Google アカウントと連携");
    await expect(page.getByTestId("cloud-sync-status")).toContainText("未連携");

    // =========================================================================
    // ステップ6: 手動連携解除とローカルデータ保持確認（AC-ST-10, R1-31）
    // =========================================================================
    // 1. 401 シミュレートを解除し、再度 Google アカウントと正常連携
    await page.evaluate(() => {
      localStorage.removeItem("yommy_mock_gdrive_401");
    });
    await reauthButton.click();
    await expect(page.getByTestId("cloud-sync-status")).toContainText("連携中");

    // 2. 作品データを本棚に登録（手動連携解除後もローカル作品が保持されることを検証するため）
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

    // 3. 設定画面で「Google アカウント連携を解除」ボタンをクリック（AC-ST-10）
    const disconnectBtn = page.getByTestId("cloud-sync-disconnect-button");
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // 4. 確認ダイアログが表示されることを確認
    const disconnectDialog = page.getByTestId("cloud-sync-disconnect-dialog");
    await expect(disconnectDialog).toBeVisible();

    // 5. 「連携を解除する」ボタンをクリック
    const confirmDisconnectBtn = page.getByTestId(
      "cloud-sync-disconnect-confirm-button",
    );
    await expect(confirmDisconnectBtn).toBeVisible();
    await confirmDisconnectBtn.click();

    // 6. 設定画面で未連携状態（「Google アカウントと連携」ボタン表示）へ遷移することを確認
    await expect(reauthButton).toBeVisible();
    await expect(page.getByTestId("cloud-sync-status")).toContainText("未連携");

    // 7. 本棚タブへ戻り、ローカルの作品データが削除されず保持されていることを確認（AC-ST-10）
    await page.getByTestId("tab-bookshelf").click();
    await expect(page).toHaveURL("/");
    const retainedNovelCards = page.getByTestId("novel-card");
    await expect(retainedNovelCards).toHaveCount(2);
    await expect(page.getByText("境界迷宮と異界の魔術師")).toBeVisible();
    await expect(
      page.getByText("無職転生 - 異世界行ったら本気だす"),
    ).toBeVisible();
  });
});
