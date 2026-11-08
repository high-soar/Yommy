import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./WebViewImportPage.stories";
import { WebViewImportPage } from "./WebViewImportPage";

const { Default, UnsupportedUrl, Loading, WithNotice, WithError } =
  composeStories(stories);

describe("WebViewImportPage", () => {
  it("Default ストーリーが正常に描画され、主要要素が存在すること", () => {
    render(<Default />);

    expect(screen.getByTestId("webview-import-page")).toBeInTheDocument();
    expect(screen.getByTestId("browser-back-button")).toBeInTheDocument();
    expect(screen.getByTestId("browser-url-input")).toHaveValue(
      "https://kakuyomu.jp/works/16817330658027210412",
    );
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

    expect(screen.getByTestId("browser-loading")).toBeInTheDocument();
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
});
