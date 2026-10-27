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
  resolveInitialPath,
} from "./router";

const { BookshelfRoute, NovelDetailRoute, ReaderRoute, SettingsRoute, UnknownFallbackRoute } =
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

    it("SettingsRoute ストーリーが設定画面ルートを描画すること", () => {
      render(<SettingsRoute />);
      expect(screen.getByTestId("current-path")).toHaveTextContent("Path: /settings");
      expect(screen.getByTestId("route-name")).toHaveTextContent("Route: settings");
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

    it("/settings で settings ルートが解決されること", () => {
      expect(matchRoute("/settings")).toEqual({
        name: "settings",
        path: "/settings",
      });
      expect(matchRoute("/settings/")).toEqual({
        name: "settings",
        path: "/settings",
      });
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

    it("空文字の novelId の場合は bookshelf へフォールバックすること", () => {
      expect(matchRoute("/novels/%20")).toEqual({
        name: "bookshelf",
        path: "/",
      });
      expect(matchRoute("/novels/%20/chapters/1")).toEqual({
        name: "bookshelf",
        path: "/",
      });
    });

    it("未知のパスの場合は bookshelf へフォールバックすること", () => {
      expect(matchRoute("/unknown/route")).toEqual({
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

  describe("resolveInitialPath パス解決検証", () => {
    it("initialPath が指定されている場合はそれを優先すること", () => {
      expect(resolveInitialPath("/custom", "/fallback")).toBe("/custom");
    });

    it("initialPath が未指定で fallbackPath がある場合はそれを利用すること", () => {
      expect(resolveInitialPath(undefined, "/fallback")).toBe("/fallback");
    });

    it("initialPath も fallbackPath もない場合は / を返すこと", () => {
      expect(resolveInitialPath(undefined, undefined)).toBe("/");
      expect(resolveInitialPath(undefined, "")).toBe("/");
    });
  });

  describe("画面遷移ナビゲーションと History API 同期検証", () => {
    const TestConsumer: React.FC = () => {
      const router = useRouter();
      return (
        <div>
          <span data-testid="path-display">{router.currentPath}</span>
          <span data-testid="route-display">{router.route.name}</span>
          <span data-testid="previous-path-display">{router.previousPath ?? "none"}</span>
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
            data-testid="btn-reader-resume"
            onClick={() =>
              router.navigateToReader("kakuyomu:16817330658027210412", 5, {
                fromBookshelfResume: true,
              })
            }
          >
            リーダー続きから
          </button>
          <button
            data-testid="btn-reader-replace"
            onClick={() =>
              router.navigateToReader("kakuyomu:16817330658027210412", 6, {
                replace: true,
              })
            }
          >
            リーダー次話置換
          </button>
          <button
            data-testid="btn-settings"
            onClick={() => router.navigateToSettings()}
          >
            設定
          </button>
          <button data-testid="btn-back" onClick={() => router.back()}>
            戻る
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

    it("navigateToBookshelf, navigateToNovelDetail, navigateToReader, navigateToSettings, navigate で画面遷移できること", () => {
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
      expect(screen.getByTestId("previous-path-display")).toHaveTextContent("/");

      act(() => {
        screen.getByTestId("btn-reader").click();
      });
      expect(screen.getByTestId("path-display")).toHaveTextContent(
        "/novels/kakuyomu%3A16817330658027210412/chapters/5",
      );
      expect(screen.getByTestId("route-display")).toHaveTextContent("reader");
      expect(screen.getByTestId("previous-path-display")).toHaveTextContent(
        "/novels/kakuyomu%3A16817330658027210412",
      );

      act(() => {
        screen.getByTestId("btn-settings").click();
      });
      expect(screen.getByTestId("path-display")).toHaveTextContent("/settings");
      expect(screen.getByTestId("route-display")).toHaveTextContent("settings");
      expect(screen.getByTestId("previous-path-display")).toHaveTextContent(
        "/novels/kakuyomu%3A16817330658027210412/chapters/5",
      );

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

    describe("論理階層遷移制御 (back, fromBookshelfResume, replace)", () => {
      it("各話View (SCR-03) から back() を呼んだとき、親である目次画面 (SCR-02) へ遷移すること", () => {
        render(
          <RouterProvider initialPath="/novels/work1/chapters/3">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });

        expect(screen.getByTestId("path-display")).toHaveTextContent("/novels/work1");
        expect(screen.getByTestId("route-display")).toHaveTextContent("novel-detail");
      });

      it("目次画面 (SCR-02) から back() を呼んだとき、親である本棚画面 (SCR-01) へ遷移すること", () => {
        render(
          <RouterProvider initialPath="/novels/work1">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });

        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent("bookshelf");
      });

      it("設定画面 (SCR-05) から back() を呼んだとき、直前の previousPath へ復帰すること", () => {
        render(
          <RouterProvider initialPath="/novels/work1">
            <TestConsumer />
          </RouterProvider>,
        );

        // 詳細から設定へ
        act(() => {
          screen.getByTestId("btn-settings").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/settings");

        // 戻る
        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/novels/work1");
        expect(screen.getByTestId("route-display")).toHaveTextContent("novel-detail");
      });

      it("設定画面 (SCR-05) に直接アクセスした場合、previousPath が無いため本棚画面 (/) へ復帰すること", () => {
        render(
          <RouterProvider initialPath="/settings">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent("bookshelf");
      });

      it("本棚画面 (SCR-01) で back() を呼んだ場合、論理親がないためパスが変わらないこと", () => {
        render(
          <RouterProvider initialPath="/">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent("bookshelf");
      });

      it("本棚の「続きから読む」(fromBookshelfResume: true) で直行した場合、履歴スタックに目次が介在すること", () => {
        const pushSpy = vi.spyOn(window.history, "pushState");
        render(
          <RouterProvider initialPath="/">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-reader-resume").click();
        });

        // 1回目の pushState が目次 (/novels/kakuyomu...) で、2回目がリーダー (/novels/.../chapters/5) であること
        expect(pushSpy).toHaveBeenCalledWith(null, "", "/novels/kakuyomu%3A16817330658027210412");
        expect(pushSpy).toHaveBeenCalledWith(null, "", "/novels/kakuyomu%3A16817330658027210412/chapters/5");

        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412/chapters/5",
        );
        expect(screen.getByTestId("previous-path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412",
        );
      });

      it("リーダー話数遷移で replace: true を指定した場合、history.replaceState が呼ばれること", () => {
        const replaceSpy = vi.spyOn(window.history, "replaceState");
        render(
          <RouterProvider initialPath="/novels/kakuyomu%3A16817330658027210412/chapters/5">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-reader-replace").click();
        });

        expect(replaceSpy).toHaveBeenCalledWith(
          null,
          "",
          "/novels/kakuyomu%3A16817330658027210412/chapters/6",
        );
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412/chapters/6",
        );
      });
    });
  });
});
