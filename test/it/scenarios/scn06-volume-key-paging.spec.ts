import { test, expect } from "@playwright/test";

test.describe("SCN-06: ハードウェア音量キーによるページ送り・スクロール送り・境界2段階遷移・設定ON/OFF連動シナリオ (SYS-REQ-11, AC-ST-19, AC-RD-26, AC-RD-27)", () => {
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

    // テスト用小説（カクヨム4話構成サンプル）を登録
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
        window.__yommyServices.isReady === true,
    );
  });

  test("設定画面ON/OFFトグル・リーダー画面音量キーページ送り（縦書きスライド）・オーバーレイ自動消去・境界2段階遷移・連続スクロール・無効時抑止の一連の動作が正常に機能する", async ({
    page,
  }) => {
    // 1. 設定画面（/settings）で初期状態で音量キートグルが OFF であることを確認（SYS-REQ-11 / AC-ST-19）
    const tabSettings = page.getByTestId("tab-settings");
    await tabSettings.click();
    await expect(page).toHaveURL("/settings");

    const toggleVolumeKey = page.getByTestId("toggle-volume-key-paging");
    await expect(toggleVolumeKey).toBeVisible();
    await expect(toggleVolumeKey).not.toBeChecked();

    // 2. 初期状態（OFF）でリーダー画面へ遷移し、音量キーを押下してもページめくりが発生しないことを確認
    await page.goto("/novels/kakuyomu:16817330658027210412/chapters/1");
    const readerView = page.getByTestId("reader-view");
    await expect(readerView).toBeVisible();
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    // 音量［ー］（次ページ）を押下
    await page.keyboard.press("AudioVolumeDown");
    // 100ms 待機後もページ1のままであること
    await page.waitForTimeout(200);
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    // 3. 設定画面（/settings）へ戻り、「音量キーでページ送り」トグルを ON に変更・永続化確認（AC-ST-19）
    await page.goto("/settings");
    await expect(toggleVolumeKey).toBeVisible();
    await toggleVolumeKey.click();
    await expect(toggleVolumeKey).toBeChecked();

    // リロードしても ON が維持されることを確認（永続化検証）
    await page.reload();
    await expect(page.getByTestId("toggle-volume-key-paging")).toBeChecked();

    // 4. リーダー画面（/novels/.../chapters/1）へ遷移し、音量［ー］/［＋］によるページ送り・戻りを検証（AC-RD-26）
    await page.goto("/novels/kakuyomu:16817330658027210412/chapters/1");
    await expect(readerView).toBeVisible();
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    // 音量［ー］（Volume Down）で次ページ（page 2）へめくられること
    await page.keyboard.press("AudioVolumeDown");
    await expect(readerView).toHaveAttribute("data-current-page", "2");

    // 音量［＋］（Volume Up）で前ページ（page 1）へ戻ること
    await page.keyboard.press("AudioVolumeUp");
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    // 5. オーバーレイ展開状態で音量キーを押下した際、オーバーレイが自動で閉じられることを確認（AC-RD-26）
    const topOverlay = page.getByTestId("reader-top-overlay");
    const bottomOverlay = page.getByTestId("reader-bottom-overlay");
    await expect(topOverlay).toHaveClass(/-translate-y-full/);
    await expect(bottomOverlay).toHaveClass(/translate-y-full/);

    // 画面中央タップで上下オーバーレイを展開
    const readerBox = await readerView.boundingBox();
    expect(readerBox).not.toBeNull();
    if (readerBox) {
      await page.mouse.click(
        readerBox.x + readerBox.width * 0.5,
        readerBox.y + readerBox.height * 0.5,
      );
    }
    await expect(topOverlay).toHaveClass(/translate-y-0/);
    await expect(bottomOverlay).toHaveClass(/translate-y-0/);

    // 音量キー（音量［ー］）を押下すると、オーバーレイが閉じられ次ページへめくられること
    await page.keyboard.press("AudioVolumeDown");
    await expect(topOverlay).toHaveClass(/-translate-y-full/);
    await expect(bottomOverlay).toHaveClass(/translate-y-full/);
    await expect(readerView).toHaveAttribute("data-current-page", "2");

    // 6. 最終ページ到達時の2段階操作による次話遷移の検証（AC-RD-27）
    // 最終ページまで進める
    const totalPagesStr = (await readerView.getAttribute("data-total-pages"))!;
    const totalPages = Number(totalPagesStr);
    while (
      Number(await readerView.getAttribute("data-current-page")) < totalPages
    ) {
      await page.keyboard.press("AudioVolumeDown");
      await page.waitForTimeout(350); // アニメーション完了待機
    }
    await expect(readerView).toHaveAttribute(
      "data-current-page",
      String(totalPages),
    );

    // 最終ページで音量［ー］の1回目押下: 案内ヒント「もう一度操作で次の話へ」が表示されること
    await page.keyboard.press("AudioVolumeDown");
    const boundaryHint = page.getByTestId("reader-episode-boundary-hint");
    await expect(boundaryHint).toBeVisible();
    await expect(boundaryHint).toHaveText("もう一度操作で次の話へ");

    // 2.5秒以内の2回目音量［ー］押下: 第2話へ確定遷移すること
    await page.keyboard.press("AudioVolumeDown");
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/2/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "第1話 見知らぬ空",
    );
    await expect(readerView).toHaveAttribute("data-current-page", "1");

    // 7. 第2話第1ページでの2段階操作による前話遷移の検証（AC-RD-27）
    // 第1ページで音量［＋］の1回目押下: 案内ヒント「もう一度操作で前の話へ」が表示されること
    await page.keyboard.press("AudioVolumeUp");
    await expect(boundaryHint).toBeVisible();
    await expect(boundaryHint).toHaveText("もう一度操作で前の話へ");

    // 2.5秒以内の2回目音量［＋］押下: 第1話へ戻ること
    await page.keyboard.press("AudioVolumeUp");
    await expect(page).toHaveURL(
      /\/novels\/kakuyomu(%3A|:)16817330658027210412\/chapters\/1/,
    );
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );

    // 8. 連続スクロールモードでの音量キースクロール送り検証（AC-RD-26）
    // 設定画面で横書きに変更（横書き時は連続スクロール固定）
    await page.goto("/settings");
    const toggleOrientation = page.getByTestId("toggle-orientation");
    await toggleOrientation.click();

    // リーダー画面へ戻る
    await page.goto("/novels/kakuyomu:16817330658027210412/chapters/1");
    await expect(readerView).toBeVisible();
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "scroll",
    );

    // スクロール位置を先頭（0）に設定
    await readerView.evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event("scroll"));
    });
    await expect
      .poll(async () => {
        return readerView.evaluate((el) => el.scrollTop);
      })
      .toBe(0);

    // 音量［ー］押下で順方向へスクロールすること
    await page.keyboard.press("AudioVolumeDown");
    await expect
      .poll(async () => {
        return readerView.evaluate((el) => el.scrollTop);
      })
      .toBeGreaterThan(50);

    const scrolledTop = await readerView.evaluate((el) => el.scrollTop);

    // 音量［＋］押下で逆方向へスクロールが戻ること
    await page.keyboard.press("AudioVolumeUp");
    await expect
      .poll(async () => {
        return readerView.evaluate((el) => el.scrollTop);
      })
      .toBeLessThan(scrolledTop);

    // 9. 設定画面でトグルを OFF に戻した際、音量キー操作が無効化されることの検証
    await page.goto("/settings");
    const toggleVolumeKeyOff = page.getByTestId("toggle-volume-key-paging");
    await toggleVolumeKeyOff.click();
    await expect(toggleVolumeKeyOff).not.toBeChecked();

    // 縦書きに戻す
    const orientationToggle = page.getByTestId("toggle-orientation");
    await orientationToggle.click();
    await expect(page.getByTestId("sample-text-preview")).toHaveAttribute(
      "data-writing-mode",
      "vertical-rl",
    );

    // リーダーへ戻る
    await page.goto("/novels/kakuyomu:16817330658027210412/chapters/1");
    await expect(page.getByTestId("reader-chapter-title")).toHaveText(
      "プロローグ：目覚め",
    );
    await expect(readerView).toBeVisible();
    await expect(readerView).toHaveAttribute(
      "data-effective-paging-mode",
      "paged",
    );
    await expect(readerView).toHaveAttribute("data-total-pages", /^[1-9]\d*$/);
    await expect(readerView).toHaveAttribute("data-current-page", /^[1-9]\d*$/);
    const currentPageBefore =
      (await readerView.getAttribute("data-current-page"))!;

    // 音量［ー］を押下してもページめくりが発生しないこと（設定OFFのため無効）
    await page.keyboard.press("AudioVolumeDown");
    await page.waitForTimeout(200);
    await expect(readerView).toHaveAttribute(
      "data-current-page",
      currentPageBefore,
    );

    // 音量［＋］を押下してもページめくりが発生しないこと（設定OFFのため無効）
    await page.keyboard.press("AudioVolumeUp");
    await page.waitForTimeout(200);
    await expect(readerView).toHaveAttribute(
      "data-current-page",
      currentPageBefore,
    );
  });
});
