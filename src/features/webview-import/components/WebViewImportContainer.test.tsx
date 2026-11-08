import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./WebViewImportContainer.stories";
import { WebViewImportContainer } from "./WebViewImportContainer";
import * as WebViewImportPageModule from "./WebViewImportPage";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { RouterProvider } from "../../../app/router";
import { MockWebViewDomBridge } from "../../../bridges/webview/mockWebViewDomBridge";

const { Default, UnsupportedUrl, Loading } = composeStories(stories);

describe("WebViewImportContainer", () => {
  let bridge: MockWebViewDomBridge;

  beforeEach(() => {
    bridge = new MockWebViewDomBridge();
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
});
