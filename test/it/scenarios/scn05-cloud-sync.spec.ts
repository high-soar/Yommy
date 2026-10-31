import { test, expect } from "@playwright/test";

test.describe("SCN-05: Google Drive appDataFolder によるクラウド同期・端末間引き継ぎ・Tombstone伝播・401失効検知シナリオ", () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // ローカルストレージをクリアして初期状態から開始
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("設定画面でのGoogle連携・端末Aでの作品閲覧自動Push・端末Bでの自動Pull復元・削除Tombstone伝播・401失効検知安全フォールバックが一連として正常に機能する", async ({
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

    // 3. 本棚に作品カードが表示されていることを確認
    const novelCard = page.getByTestId("novel-card");
    await expect(novelCard).toBeVisible();
    await expect(page.getByTestId("novel-card-title")).toHaveText(
      "境界迷宮と異界の魔術師",
    );

    // 4. 作品カードをクリックして作品詳細（SCR-02）へ遷移
    const novelCardSelect = page.getByTestId("novel-card-select");
    await novelCardSelect.click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    // 5. 目次一覧から第2話エピソード行を選択して第2話へ進む（SCR-03）
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

    // 6. リーダーでスクロールし、第2話のしおり進捗を保存
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="reader-view"]');
      if (el) {
        el.scrollLeft = -100;
        el.dispatchEvent(new Event("scroll"));
      }
    });

    // 7. ブラウザ戻る操作で作品詳細へ戻る
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );
    const resumeButton = page.getByTestId("detail-resume-button");
    await expect(resumeButton).toBeVisible();
    await expect(resumeButton).toContainText("続きから読む（第2話）");

    // 8. 2.5秒のデバウンス auto-push が発火し、モック Drive のリモートデータに作品情報・第2話しおり（bookmarkChapterIndex: 2）が記録されるのを待機
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("yommy_mock_gdrive_file");
        if (!raw) return false;
        try {
          const parsed = JSON.parse(raw);
          const novel = parsed?.novels?.["kakuyomu:16817330658027210412"];
          return (
            Boolean(novel) &&
            novel.bookmarkChapterIndex === 2 &&
            novel.title === "境界迷宮と異界の魔術師"
          );
        } catch {
          return false;
        }
      },
      { timeout: 10000 },
    );

    // =========================================================================
    // ステップ3: 端末 B（DB リセット状態）での起動時自動 Pull、作品自動取得、第2話しおり復帰確認
    // =========================================================================
    // 1. 端末 A の DB バックアップをローカル変数に退避
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

    // 4. SyncEngine がリモートの作品を検知し、HttpClient 経由で目次を取得してローカル DB に登録し、
    //    本棚画面に当該作品カードが表示されることを確認
    const novelCardB = page.getByTestId("novel-card");
    await expect(novelCardB).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("novel-card-title")).toHaveText(
      "境界迷宮と異界の魔術師",
    );
    await expect(page.getByTestId("novel-card-bookmark")).toContainText("2話");

    // 5. 作品カードをクリックして作品詳細へ遷移
    await page.getByTestId("novel-card-select").click();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    // 6. 「続きから読む（第2話）」ボタンが表示され、第2話から再開できることを確認
    const resumeButtonB = page.getByTestId("detail-resume-button");
    await expect(resumeButtonB).toBeVisible();
    await expect(resumeButtonB).toContainText("続きから読む（第2話）");
    await resumeButtonB.click();

    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );

    // =========================================================================
    // ステップ4: 端末 B での作品削除と端末 A への Tombstone 削除伝播確認
    // =========================================================================
    // 1. 作品詳細画面に戻る
    await page.goBack();
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412$/,
    );

    // 2. 端末 B で作品を削除（作品詳細画面の「作品を削除」ダイアログ経由）
    const deleteButton = page.getByTestId("open-delete-dialog-button");
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    const deleteDialog = page.getByTestId("delete-confirm-dialog");
    await expect(deleteDialog).toBeVisible();

    const confirmDeleteBtn = page.getByTestId("confirm-delete-button");
    await confirmDeleteBtn.click();

    // 3. 削除完了後、本棚画面（/）へ戻り、空状態（bookshelf-empty）になることを確認
    await expect(page).toHaveURL("/");
    await expect(page.getByTestId("bookshelf-empty")).toBeVisible();

    // 4. 自動 Push によりリモートデータの deletedNovels に当該作品 ID が記録されるのを待機
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("yommy_mock_gdrive_file");
        if (!raw) return false;
        try {
          const parsed = JSON.parse(raw);
          return (
            Boolean(parsed?.deletedNovels?.["kakuyomu:16817330658027210412"]) &&
            !parsed?.novels?.["kakuyomu:16817330658027210412"]
          );
        } catch {
          return false;
        }
      },
      { timeout: 10000 },
    );

    // 5. 端末 A（端末 A の DB 状態に戻す）をシミュレート
    await page.evaluate((backup) => {
      localStorage.setItem("yommy_sqlite_db_backup", backup!);
    }, terminalABackup);

    // 6. ページをリロードして本棚を表示。起動時自動 Pull によりリモートの Tombstone を検知し、
    //    端末 A のローカル DB からも作品が削除され、本棚が空状態になることを確認
    await page.reload();
    await expect(page.getByTestId("bookshelf-empty")).toBeVisible({
      timeout: 15000,
    });

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
  });
});
