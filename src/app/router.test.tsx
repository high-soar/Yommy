import { render, screen, act } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./router.stories";
import {
  RouterProvider,
  useRouter,
  matchRoute,
  safeDecodeURIComponent,
} from "./router";

const { BookshelfRoute, NovelDetailRoute, ReaderRoute, UnknownFallbackRoute } =
  composeStories(stories);

describe("router", () => {
  beforeEach(() => {
    window.history.pushState(null, "", "/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("BookshelfRoute ストーリーが本棚画面ルートを描画すること", () => {
      render(<BookshelfRoute />);
      expect(screen.getByTestId("current-path")).toHaveTextContent("Path: /");
      expect(screen.getByTestId("route-name")).toHaveTextContent(
        "Route: bookshelf",
      );
    });

    it("NovelDetailRoute ストーリーが作品詳細ルートと novelId を描画すること", () => {
      render(<NovelDetailRoute />);
      expect(screen.getByTestId("current-path")).toHaveTextContent(
        "Path: /novels/kakuyomu%3A16817330658027210412",
      );
      expect(screen.getByTestId("route-name")).toHaveTextContent(
        "Route: novel-detail",
      );
      expect(screen.getByTestId("route-novel-id")).toHaveTextContent(
        "Novel ID: kakuyomu:16817330658027210412",
      );
    });

    it("ReaderRoute ストーリーがリーダー画面ルートと chapterIndex を描画すること", () => {
      render(<ReaderRoute />);
      expect(screen.getByTestId("current-path")).toHaveTextContent(
        "Path: /novels/kakuyomu%3A16817330658027210412/chapters/1",
      );
      expect(screen.getByTestId("route-name")).toHaveTextContent(
        "Route: reader",
      );
      expect(screen.getByTestId("route-novel-id")).toHaveTextContent(
        "Novel ID: kakuyomu:16817330658027210412",
      );
      expect(screen.getByTestId("route-chapter-index")).toHaveTextContent(
        "Chapter: 1",
      );
    });

    it("UnknownFallbackRoute ストーリーが未知パスを本棚ルートへフォールバックすること", () => {
      render(<UnknownFallbackRoute />);
      expect(screen.getByTestId("current-path")).toHaveTextContent(
        "Path: /unknown/non-existent-page",
      );
      expect(screen.getByTestId("route-name")).toHaveTextContent(
        "Route: bookshelf",
      );
    });
  });

  describe("useRouter フック境界値検証", () => {
    it("RouterProvider 外で useRouter を呼び出した場合にエラーがスローされること", () => {
      const BadConsumer: React.FC = () => {
        useRouter();
        return null;
      };

      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<BadConsumer />)).toThrow(
        "useRouter must be used within a RouterProvider",
      );
      spy.mockRestore();
    });
  });

  describe("matchRoute 純粋関数検証", () => {
    it("/ または空文字で bookshelf ルートが解決されること", () => {
      expect(matchRoute("/")).toEqual({ name: "bookshelf", path: "/" });
      expect(matchRoute("")).toEqual({ name: "bookshelf", path: "/" });
      expect(matchRoute("   ")).toEqual({ name: "bookshelf", path: "/" });
    });

    it("/novels/:novelId で novel-detail ルートが安全に解決されること", () => {
      expect(matchRoute("/novels/kakuyomu%3A16817330658027210412")).toEqual({
        name: "novel-detail",
        path: "/novels/kakuyomu%3A16817330658027210412",
        novelId: "kakuyomu:16817330658027210412",
      });

      // 末尾スラッシュ付き
      expect(matchRoute("/novels/work123/")).toEqual({
        name: "novel-detail",
        path: "/novels/work123",
        novelId: "work123",
      });
    });

    it("/novels/:novelId/chapters/:chapterIndex で reader ルートが解決されること", () => {
      expect(
        matchRoute("/novels/kakuyomu%3A16817330658027210412/chapters/3"),
      ).toEqual({
        name: "reader",
        path: "/novels/kakuyomu%3A16817330658027210412/chapters/3",
        novelId: "kakuyomu:16817330658027210412",
        chapterIndex: 3,
      });
    });

    it("無効な話数（0以下または非数値）の場合は bookshelf へフォールバックすること", () => {
      expect(matchRoute("/novels/work123/chapters/0")).toEqual({
        name: "bookshelf",
        path: "/",
      });
      expect(matchRoute("/novels/work123/chapters/abc")).toEqual({
        name: "bookshelf",
        path: "/",
      });
    });

    it("未知のパスの場合は bookshelf へフォールバックすること", () => {
      expect(matchRoute("/settings")).toEqual({
        name: "bookshelf",
        path: "/",
      });
      expect(matchRoute("/novels/work123/extra/sub")).toEqual({
        name: "bookshelf",
        path: "/",
      });
    });
  });

  describe("safeDecodeURIComponent 安全デコード検証", () => {
    it("通常のエンコード文字列をデコードできること", () => {
      expect(safeDecodeURIComponent("kakuyomu%3A123")).toBe("kakuyomu:123");
      expect(safeDecodeURIComponent("simple")).toBe("simple");
    });

    it("不正なパーセントエンコード文字列で例外をスローせず生文字列を返すこと", () => {
      expect(safeDecodeURIComponent("%E0%A4%A")).toBe("%E0%A4%A");
    });
  });

  describe("画面遷移ナビゲーションと History API 同期検証", () => {
    const TestConsumer: React.FC = () => {
      const router = useRouter();
      return (
        <div>
          <span data-testid="path-display">{router.currentPath}</span>
          <span data-testid="route-display">{router.route.name}</span>
          <button
            data-testid="btn-bookshelf"
            onClick={() => router.navigateToBookshelf()}
          >
            本棚
          </button>
          <button
            data-testid="btn-detail"
            onClick={() =>
              router.navigateToNovelDetail("kakuyomu:16817330658027210412")
            }
          >
            詳細
          </button>
          <button
            data-testid="btn-reader"
            onClick={() =>
              router.navigateToReader("kakuyomu:16817330658027210412", 5)
            }
          >
            リーダー
          </button>
          <button
            data-testid="btn-custom"
            onClick={() => router.navigate("/custom/path")}
          >
            カスタム
          </button>
        </div>
      );
    };

    it("navigateToBookshelf, navigateToNovelDetail, navigateToReader, navigate で画面遷移できること", () => {
      render(
        <RouterProvider initialPath="/">
          <TestConsumer />
        </RouterProvider>,
      );

      expect(screen.getByTestId("path-display")).toHaveTextContent("/");
      expect(screen.getByTestId("route-display")).toHaveTextContent(
        "bookshelf",
      );

      act(() => {
        screen.getByTestId("btn-detail").click();
      });
      expect(screen.getByTestId("path-display")).toHaveTextContent(
        "/novels/kakuyomu%3A16817330658027210412",
      );
      expect(screen.getByTestId("route-display")).toHaveTextContent(
        "novel-detail",
      );

      act(() => {
        screen.getByTestId("btn-reader").click();
      });
      expect(screen.getByTestId("path-display")).toHaveTextContent(
        "/novels/kakuyomu%3A16817330658027210412/chapters/5",
      );
      expect(screen.getByTestId("route-display")).toHaveTextContent("reader");

      act(() => {
        screen.getByTestId("btn-custom").click();
      });
      expect(screen.getByTestId("path-display")).toHaveTextContent(
        "/custom/path",
      );
      expect(screen.getByTestId("route-display")).toHaveTextContent(
        "bookshelf",
      );

      act(() => {
        screen.getByTestId("btn-bookshelf").click();
      });
      expect(screen.getByTestId("path-display")).toHaveTextContent("/");
      expect(screen.getByTestId("route-display")).toHaveTextContent(
        "bookshelf",
      );
    });

    it("popstate イベント発火時にブラウザの pathname と同期すること", () => {
      render(
        <RouterProvider initialPath="/">
          <TestConsumer />
        </RouterProvider>,
      );

      act(() => {
        window.history.pushState(
          null,
          "",
          "/novels/kakuyomu%3A16817330658027210412",
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      expect(screen.getByTestId("path-display")).toHaveTextContent(
        "/novels/kakuyomu%3A16817330658027210412",
      );
      expect(screen.getByTestId("route-display")).toHaveTextContent(
        "novel-detail",
      );
    });

    it("initialPath プロパティが変化したときに currentPath が同期すること", () => {
      const { rerender } = render(
        <RouterProvider initialPath="/">
          <TestConsumer />
        </RouterProvider>,
      );
      expect(screen.getByTestId("path-display")).toHaveTextContent("/");

      rerender(
        <RouterProvider initialPath="/novels/sample123">
          <TestConsumer />
        </RouterProvider>,
      );
      expect(screen.getByTestId("path-display")).toHaveTextContent(
        "/novels/sample123",
      );
    });

    it("initialPath が省略された場合は window.location.pathname が初期値となること", () => {
      window.history.pushState(null, "", "/novels/sample-init");
      render(
        <RouterProvider>
          <TestConsumer />
        </RouterProvider>,
      );
      expect(screen.getByTestId("path-display")).toHaveTextContent(
        "/novels/sample-init",
      );
    });
  });
});
