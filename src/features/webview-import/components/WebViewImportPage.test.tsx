import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, afterEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as BottomTabBarModule from "../../../shared/ui/BottomTabBar";
import * as stories from "./WebViewImportPage.stories";
import { WebViewImportPage } from "./WebViewImportPage";

const { Default, UnsupportedUrl, Loading, WithNotice, WithError } =
  composeStories(stories);

describe("WebViewImportPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Default ストーリーが正常に描画され、主要要素が存在すること", () => {
    render(<Default />);

    expect(screen.getByTestId("webview-import-page")).toBeInTheDocument();
    expect(screen.getByTestId("browser-back-button")).toBeInTheDocument();
    const urlInput = screen.getByTestId("browser-url-input");
    expect(urlInput).toHaveValue(
      "https://kakuyomu.jp/works/16817330658027210412",
    );
    expect(urlInput).toHaveAttribute("aria-label", "URLを入力");
    const previewArea = screen.getByTestId("browser-preview-area");
    expect(previewArea).toBeInTheDocument();
    expect(previewArea.tagName.toLowerCase()).toBe("div");
    expect(screen.getByTestId("browser-navigate-button")).toBeInTheDocument();
    expect(
      screen.getByTestId("open-native-browser-button"),
    ).toBeInTheDocument();

    const importButton = screen.getByTestId("import-dom-button");
    expect(importButton).toBeInTheDocument();
    expect(importButton).not.toBeDisabled();

    expect(screen.getByTestId("browser-target-title")).toHaveTextContent(
      "境界迷宮と異界の魔術師 - カクヨム",
    );
    expect(screen.getByTestId("browser-target-url")).toHaveTextContent(
      "https://kakuyomu.jp/works/16817330658027210412",
    );
  });

  it("UnsupportedUrl ストーリーで非対応警告トーストが表示され取り込みボタンが無効化されること (AC-WV-04)", () => {
    render(<UnsupportedUrl />);

    const warning = screen.getByTestId("browser-unsupported-warning");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveAttribute("role", "alert");

    const importButton = screen.getByTestId("import-dom-button");
    expect(importButton).toBeDisabled();
  });

  it("Loading ストーリーでスピナーが表示され、操作ボタンが無効化されること", () => {
    render(<Loading />);

    const loading = screen.getByTestId("browser-loading");
    expect(loading).toBeInTheDocument();
    expect(loading).toHaveTextContent("ページを取り込み中...");
    expect(screen.getByTestId("import-dom-button")).toBeDisabled();
    expect(screen.getByTestId("browser-navigate-button")).toBeDisabled();
  });

  it("WithNotice ストーリーで通知が表示されること", () => {
    render(<WithNotice />);

    const notice = screen.getByTestId("browser-notice");
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveAttribute("role", "status");
    expect(notice).toHaveTextContent("作品目次を取り込みました");
  });

  it("WithError ストーリーでエラーアラートが表示されること (AC-WV-02)", () => {
    render(<WithError />);

    const alert = screen.getByTestId("browser-error");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("role", "alert");
    expect(alert).toHaveTextContent("安全でない URL スキームは開けません");
  });

  it("各種ボタン押下時および入力変更時にコールバックが発火すること", async () => {
    const user = userEvent.setup();
    const onUrlChangeMock = vi.fn();
    const onNavigateUrlMock = vi.fn();
    const onOpenNativeBrowserMock = vi.fn();
    const onImportCurrentDomMock = vi.fn();
    const onBackMock = vi.fn();

    render(
      <WebViewImportPage
        url="https://kakuyomu.jp/works/16817330658027210412"
        pageTitle="テスト作品"
        currentCapturedUrl="https://kakuyomu.jp/works/16817330658027210412"
        canImport={true}
        isLoading={false}
        isImporting={false}
        notice={null}
        error={null}
        onUrlChange={onUrlChangeMock}
        onNavigateUrl={onNavigateUrlMock}
        onOpenNativeBrowser={onOpenNativeBrowserMock}
        onImportCurrentDom={onImportCurrentDomMock}
        onBack={onBackMock}
      />,
    );

    // 戻るボタン
    await user.click(screen.getByTestId("browser-back-button"));
    expect(onBackMock).toHaveBeenCalledTimes(1);

    // URL 入力
    const input = screen.getByTestId("browser-url-input");
    await user.clear(input);
    await user.type(input, "https://example.com");
    expect(onUrlChangeMock).toHaveBeenCalled();

    // 移動ボタン
    await user.click(screen.getByTestId("browser-navigate-button"));
    expect(onNavigateUrlMock).toHaveBeenCalledTimes(1);

    // ネイティブブラウザで直接操作ボタン
    await user.click(screen.getByTestId("open-native-browser-button"));
    expect(onOpenNativeBrowserMock).toHaveBeenCalledTimes(1);

    // 表示中ページを取り込むボタン
    await user.click(screen.getByTestId("import-dom-button"));
    expect(onImportCurrentDomMock).toHaveBeenCalledTimes(1);
  });

  it("URL 入力バーで Enter キーを押すと onNavigateUrl が発火し、他のキーでは発火しないこと", async () => {
    const user = userEvent.setup();
    const onNavigateUrlMock = vi.fn();

    render(
      <WebViewImportPage
        url="https://example.com"
        pageTitle="テスト"
        currentCapturedUrl="https://example.com"
        canImport={true}
        isLoading={false}
        isImporting={false}
        notice={null}
        error={null}
        onUrlChange={vi.fn()}
        onNavigateUrl={onNavigateUrlMock}
        onOpenNativeBrowser={vi.fn()}
        onImportCurrentDom={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const input = screen.getByTestId("browser-url-input");
    await user.type(input, "{Shift}");
    expect(onNavigateUrlMock).not.toHaveBeenCalled();

    await user.type(input, "{Enter}");
    expect(onNavigateUrlMock).toHaveBeenCalledTimes(1);
  });

  it("タブバーのコールバックおよび Props が正しく配線され、省略時もエラーが発生しないこと (R1-14)", () => {
    const bottomTabBarSpy = vi.spyOn(BottomTabBarModule, "BottomTabBar");
    const onSelectBookshelf = vi.fn();
    const onSelectSearch = vi.fn();
    const onSelectRanking = vi.fn();
    const onSelectSettings = vi.fn();

    const { rerender } = render(
      <WebViewImportPage
        url="https://example.com"
        pageTitle="テスト"
        currentCapturedUrl="https://example.com"
        canImport={true}
        isLoading={false}
        isImporting={false}
        notice={null}
        error={null}
        activeTab="search"
        onUrlChange={vi.fn()}
        onNavigateUrl={vi.fn()}
        onOpenNativeBrowser={vi.fn()}
        onImportCurrentDom={vi.fn()}
        onBack={vi.fn()}
        onSelectBookshelf={onSelectBookshelf}
        onSelectSearch={onSelectSearch}
        onSelectRanking={onSelectRanking}
        onSelectSettings={onSelectSettings}
      />,
    );

    const firstCallProps = bottomTabBarSpy.mock.calls[0][0];
    expect(firstCallProps.activeTab).toBe("search");
    expect(firstCallProps.onSelectBookshelf).toBe(onSelectBookshelf);
    expect(firstCallProps.onSelectSearch).toBe(onSelectSearch);
    expect(firstCallProps.onSelectRanking).toBe(onSelectRanking);
    expect(firstCallProps.onSelectSettings).toBe(onSelectSettings);

    // コールバック省略時
    rerender(
      <WebViewImportPage
        url="https://example.com"
        pageTitle="テスト"
        currentCapturedUrl="https://example.com"
        canImport={true}
        isLoading={false}
        isImporting={false}
        notice={null}
        error={null}
        onUrlChange={vi.fn()}
        onNavigateUrl={vi.fn()}
        onOpenNativeBrowser={vi.fn()}
        onImportCurrentDom={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const lastCallProps =
      bottomTabBarSpy.mock.calls[bottomTabBarSpy.mock.calls.length - 1][0];
    expect(lastCallProps.activeTab).toBe("bookshelf");
    expect(() => {
      lastCallProps.onSelectBookshelf?.();
      lastCallProps.onSelectSearch?.();
      lastCallProps.onSelectRanking?.();
      lastCallProps.onSelectSettings?.();
    }).not.toThrow();

    bottomTabBarSpy.mockRestore();
  });

  it("isLoading のみ true のときは『読み込み中...』が表示されること", () => {
    render(
      <WebViewImportPage
        url="https://kakuyomu.jp/works/1"
        pageTitle="テスト"
        currentCapturedUrl="https://kakuyomu.jp/works/1"
        canImport={true}
        isLoading={true}
        isImporting={false}
        notice={null}
        error={null}
        onUrlChange={vi.fn()}
        onNavigateUrl={vi.fn()}
        onOpenNativeBrowser={vi.fn()}
        onImportCurrentDom={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const loading = screen.getByTestId("browser-loading");
    expect(loading).toHaveTextContent("読み込み中...");
  });

  it("isImporting 時は『ページを取り込み中...』が表示されること", () => {
    render(
      <WebViewImportPage
        url="https://kakuyomu.jp/works/1"
        pageTitle="テスト"
        currentCapturedUrl="https://kakuyomu.jp/works/1"
        canImport={true}
        isLoading={false}
        isImporting={true}
        notice={null}
        error={null}
        onUrlChange={vi.fn()}
        onNavigateUrl={vi.fn()}
        onOpenNativeBrowser={vi.fn()}
        onImportCurrentDom={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const loading = screen.getByTestId("browser-loading");
    expect(loading).toHaveTextContent("ページを取り込み中...");
  });

  it("pageTitle および currentCapturedUrl が未定の場合のフォールバック表示を検証すること", () => {
    // 1) pageTitle なし, url あり, currentCapturedUrl なし
    const { rerender } = render(
      <WebViewImportPage
        url="https://example.com"
        pageTitle=""
        currentCapturedUrl=""
        canImport={true}
        isLoading={false}
        isImporting={false}
        notice={null}
        error={null}
        onUrlChange={vi.fn()}
        onNavigateUrl={vi.fn()}
        onOpenNativeBrowser={vi.fn()}
        onImportCurrentDom={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId("browser-target-title")).toHaveTextContent(
      "読み込み中...",
    );
    expect(screen.getByTestId("browser-target-url")).toHaveTextContent(
      "https://example.com",
    );

    // 2) pageTitle なし, url なし, currentCapturedUrl なし
    rerender(
      <WebViewImportPage
        url=""
        pageTitle=""
        currentCapturedUrl=""
        canImport={false}
        isLoading={false}
        isImporting={false}
        notice={null}
        error={null}
        onUrlChange={vi.fn()}
        onNavigateUrl={vi.fn()}
        onOpenNativeBrowser={vi.fn()}
        onImportCurrentDom={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId("browser-target-title")).toHaveTextContent(
      "未読み込み",
    );
    expect(screen.getByTestId("browser-target-url")).toHaveTextContent(
      "（URL 未指定）",
    );
  });
});
