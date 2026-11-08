import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./WebViewImportContainer.stories";
import { WebViewImportContainer } from "./WebViewImportContainer";
import * as WebViewImportPageModule from "./WebViewImportPage";
import * as useWebViewImportModule from "../hooks/useWebViewImport";
import * as routerModule from "../../../app/router";
import type { RouterContextValue } from "../../../app/router";
import type { UseWebViewImportOptions, WebViewImportPageProps } from "../types";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { MockWebViewDomBridge } from "../../../bridges/webview/mockWebViewDomBridge";

const { Default, UnsupportedUrl, Loading } = composeStories(stories);

describe("WebViewImportContainer", () => {
  let bridge: MockWebViewDomBridge;

  beforeEach(() => {
    bridge = new MockWebViewDomBridge();
    vi.restoreAllMocks();
  });

  it("Default ストーリーが正常にレンダリングされること", () => {
    render(<Default />);
    expect(screen.getByTestId("webview-import-page")).toBeInTheDocument();
  });

  it("UnsupportedUrl ストーリーが正常にレンダリングされること", () => {
    render(<UnsupportedUrl />);
    expect(screen.getByTestId("webview-import-page")).toBeInTheDocument();
  });

  it("Loading ストーリーが正常にレンダリングされること", () => {
    render(<Loading />);
    expect(screen.getByTestId("webview-import-page")).toBeInTheDocument();
  });

  it("親子分離: WebViewImportPage に正しい Props とコールバックが渡されること", () => {
    const pageSpy = vi.spyOn(WebViewImportPageModule, "WebViewImportPage");
    const onBackMock = vi.fn();
    const onImportSuccessMock = vi.fn();

    render(
      <ServiceProvider services={{ webViewDomBridge: bridge }}>
        <RouterProvider initialPath="/browser">
          <WebViewImportContainer
            initialUrl="https://kakuyomu.jp/works/16817330658027210412"
            novelId="kakuyomu:16817330658027210412"
            chapterIndex={1}
            activeTab="bookshelf"
            onBack={onBackMock}
            onImportSuccess={onImportSuccessMock}
          />
        </RouterProvider>
      </ServiceProvider>,
    );

    expect(pageSpy).toHaveBeenCalled();
    const lastProps = pageSpy.mock.calls[pageSpy.mock.calls.length - 1][0];
    expect(lastProps.url).toBe(
      "https://kakuyomu.jp/works/16817330658027210412",
    );
    expect(lastProps.activeTab).toBe("bookshelf");
    expect(typeof lastProps.onUrlChange).toBe("function");
    expect(typeof lastProps.onNavigateUrl).toBe("function");
    expect(typeof lastProps.onOpenNativeBrowser).toBe("function");
    expect(typeof lastProps.onImportCurrentDom).toBe("function");
    expect(typeof lastProps.onBack).toBe("function");
  });

  it("onImportSuccess 未指定時: 作品目次インポート成功で navigateToNovelDetail に遷移すること", () => {
    let capturedOptions: UseWebViewImportOptions | null = null;
    vi.spyOn(useWebViewImportModule, "useWebViewImport").mockImplementation(
      (options) => {
        capturedOptions = options;
        return {
          url: "https://kakuyomu.jp/works/1",
          setUrl: vi.fn(),
          pageTitle: "",
          currentCapturedUrl: "",
          canImport: true,
          isLoading: false,
          isImporting: false,
          notice: null,
          error: null,
          loadUrl: vi.fn(),
          openNativeBrowser: vi.fn(),
          importCurrentDom: vi.fn(),
          goBack: vi.fn(),
        };
      },
    );

    const navigateToNovelDetailMock = vi.fn();
    vi.spyOn(routerModule, "useRouter").mockReturnValue({
      navigateToNovelDetail: navigateToNovelDetailMock,
    } as unknown as RouterContextValue);

    render(
      <ServiceProvider services={{ webViewDomBridge: bridge }}>
        <WebViewImportContainer initialUrl="https://kakuyomu.jp/works/1" />
      </ServiceProvider>,
    );

    expect(capturedOptions).not.toBeNull();
    capturedOptions!.onImportComplete?.({
      type: "novel",
      novelId: "kakuyomu:1",
    });
    expect(navigateToNovelDetailMock).toHaveBeenCalledWith("kakuyomu:1");
  });

  it("onImportSuccess 未指定時: 各話本文インポート成功で navigateToReader に遷移すること", () => {
    let capturedOptions: UseWebViewImportOptions | null = null;
    vi.spyOn(useWebViewImportModule, "useWebViewImport").mockImplementation(
      (options) => {
        capturedOptions = options;
        return {
          url: "https://kakuyomu.jp/works/1/episodes/1",
          setUrl: vi.fn(),
          pageTitle: "",
          currentCapturedUrl: "",
          canImport: true,
          isLoading: false,
          isImporting: false,
          notice: null,
          error: null,
          loadUrl: vi.fn(),
          openNativeBrowser: vi.fn(),
          importCurrentDom: vi.fn(),
          goBack: vi.fn(),
        };
      },
    );

    const navigateToReaderMock = vi.fn();
    vi.spyOn(routerModule, "useRouter").mockReturnValue({
      navigateToReader: navigateToReaderMock,
    } as unknown as RouterContextValue);

    render(
      <ServiceProvider services={{ webViewDomBridge: bridge }}>
        <WebViewImportContainer initialUrl="https://kakuyomu.jp/works/1/episodes/1" />
      </ServiceProvider>,
    );

    capturedOptions!.onImportComplete?.({
      type: "chapter",
      novelId: "kakuyomu:1",
      chapterIndex: 3,
    });
    expect(navigateToReaderMock).toHaveBeenCalledWith("kakuyomu:1", 3);
  });

  it("onImportSuccess 指定時: インポート成功で指定コールバックが優先して呼ばれること", () => {
    let capturedOptions: UseWebViewImportOptions | null = null;
    vi.spyOn(useWebViewImportModule, "useWebViewImport").mockImplementation(
      (options) => {
        capturedOptions = options;
        return {
          url: "https://kakuyomu.jp/works/1",
          setUrl: vi.fn(),
          pageTitle: "",
          currentCapturedUrl: "",
          canImport: true,
          isLoading: false,
          isImporting: false,
          notice: null,
          error: null,
          loadUrl: vi.fn(),
          openNativeBrowser: vi.fn(),
          importCurrentDom: vi.fn(),
          goBack: vi.fn(),
        };
      },
    );

    const onImportSuccessMock = vi.fn();
    const navigateToNovelDetailMock = vi.fn();
    vi.spyOn(routerModule, "useRouter").mockReturnValue({
      navigateToNovelDetail: navigateToNovelDetailMock,
    } as unknown as RouterContextValue);

    render(
      <ServiceProvider services={{ webViewDomBridge: bridge }}>
        <WebViewImportContainer
          initialUrl="https://kakuyomu.jp/works/1"
          onImportSuccess={onImportSuccessMock}
        />
      </ServiceProvider>,
    );

    const result = { type: "novel" as const, novelId: "kakuyomu:1" };
    capturedOptions!.onImportComplete?.(result);
    expect(onImportSuccessMock).toHaveBeenCalledWith(result);
    expect(navigateToNovelDetailMock).not.toHaveBeenCalled();
  });

  it("onBack 未指定時: 戻る操作で router.back() が呼ばれること", () => {
    let capturedOptions: UseWebViewImportOptions | null = null;
    vi.spyOn(useWebViewImportModule, "useWebViewImport").mockImplementation(
      (options) => {
        capturedOptions = options;
        return {
          url: "https://kakuyomu.jp/works/1",
          setUrl: vi.fn(),
          pageTitle: "",
          currentCapturedUrl: "",
          canImport: true,
          isLoading: false,
          isImporting: false,
          notice: null,
          error: null,
          loadUrl: vi.fn(),
          openNativeBrowser: vi.fn(),
          importCurrentDom: vi.fn(),
          goBack: vi.fn(),
        };
      },
    );

    const backMock = vi.fn();
    vi.spyOn(routerModule, "useRouter").mockReturnValue({
      back: backMock,
    } as unknown as RouterContextValue);

    render(
      <ServiceProvider services={{ webViewDomBridge: bridge }}>
        <WebViewImportContainer initialUrl="https://kakuyomu.jp/works/1" />
      </ServiceProvider>,
    );

    capturedOptions!.onNavigateBack?.();
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("タブバーの各アイテム選択時に router の対応メソッドが呼ばれること", () => {
    let capturedProps: WebViewImportPageProps | null = null;
    vi.spyOn(WebViewImportPageModule, "WebViewImportPage").mockImplementation(
      (props) => {
        capturedProps = props;
        return <div data-testid="webview-import-page" />;
      },
    );

    const navigateToBookshelfMock = vi.fn();
    const navigateToSearchMock = vi.fn();
    const navigateToRankingMock = vi.fn();
    const navigateToSettingsMock = vi.fn();

    vi.spyOn(routerModule, "useRouter").mockReturnValue({
      navigateToBookshelf: navigateToBookshelfMock,
      navigateToSearch: navigateToSearchMock,
      navigateToRanking: navigateToRankingMock,
      navigateToSettings: navigateToSettingsMock,
    } as unknown as RouterContextValue);

    render(
      <ServiceProvider services={{ webViewDomBridge: bridge }}>
        <WebViewImportContainer initialUrl="https://kakuyomu.jp/works/1" />
      </ServiceProvider>,
    );

    capturedProps!.onSelectBookshelf?.();
    expect(navigateToBookshelfMock).toHaveBeenCalledTimes(1);

    capturedProps!.onSelectSearch?.();
    expect(navigateToSearchMock).toHaveBeenCalledTimes(1);

    capturedProps!.onSelectRanking?.();
    expect(navigateToRankingMock).toHaveBeenCalledTimes(1);

    capturedProps!.onSelectSettings?.();
    expect(navigateToSettingsMock).toHaveBeenCalledTimes(1);
  });

  it("onBack 指定時: 戻る操作で onBack コールバックが呼ばれること", () => {
    let capturedOptions: UseWebViewImportOptions | null = null;
    vi.spyOn(useWebViewImportModule, "useWebViewImport").mockImplementation(
      (options) => {
        capturedOptions = options;
        return {
          url: "https://kakuyomu.jp/works/1",
          setUrl: vi.fn(),
          pageTitle: "",
          currentCapturedUrl: "",
          canImport: true,
          isLoading: false,
          isImporting: false,
          notice: null,
          error: null,
          loadUrl: vi.fn(),
          openNativeBrowser: vi.fn(),
          importCurrentDom: vi.fn(),
          goBack: vi.fn(),
        };
      },
    );

    const onBackMock = vi.fn();

    render(
      <ServiceProvider services={{ webViewDomBridge: bridge }}>
        <RouterProvider initialPath="/browser">
          <WebViewImportContainer
            initialUrl="https://kakuyomu.jp/works/1"
            onBack={onBackMock}
          />
        </RouterProvider>
      </ServiceProvider>,
    );

    capturedOptions!.onNavigateBack?.();
    expect(onBackMock).toHaveBeenCalledTimes(1);
  });

  it("Page に渡された onNavigateUrl と onImportCurrentDom のラッパー関数が正常に実行されること", () => {
    let capturedProps: WebViewImportPageProps | null = null;
    vi.spyOn(WebViewImportPageModule, "WebViewImportPage").mockImplementation(
      (props) => {
        capturedProps = props;
        return <div data-testid="webview-import-page" />;
      },
    );

    const loadUrlMock = vi.fn().mockResolvedValue(true);
    const importCurrentDomMock = vi.fn().mockResolvedValue(null);

    vi.spyOn(useWebViewImportModule, "useWebViewImport").mockReturnValue({
      url: "https://kakuyomu.jp/works/1",
      setUrl: vi.fn(),
      pageTitle: "",
      currentCapturedUrl: "",
      canImport: true,
      isLoading: false,
      isImporting: false,
      notice: null,
      error: null,
      loadUrl: loadUrlMock,
      openNativeBrowser: vi.fn(),
      importCurrentDom: importCurrentDomMock,
      goBack: vi.fn(),
    });

    render(
      <ServiceProvider services={{ webViewDomBridge: bridge }}>
        <RouterProvider initialPath="/browser">
          <WebViewImportContainer initialUrl="https://kakuyomu.jp/works/1" />
        </RouterProvider>
      </ServiceProvider>,
    );

    capturedProps!.onNavigateUrl();
    expect(loadUrlMock).toHaveBeenCalledTimes(1);

    capturedProps!.onImportCurrentDom();
    expect(importCurrentDomMock).toHaveBeenCalledTimes(1);
  });
});
