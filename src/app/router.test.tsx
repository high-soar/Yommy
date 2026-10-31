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

const {
  BookshelfRoute,
  SearchRoute,
  RankingRoute,
  NovelDetailRoute,
  ReaderRoute,
  SettingsRoute,
  UnknownFallbackRoute,
} = composeStories(stories);

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

    it("SearchRoute ストーリーが検索画面ルートを描画すること (SCR-06)", () => {
      render(<SearchRoute />);
      expect(screen.getByTestId("current-path")).toHaveTextContent(
        "Path: /search",
      );
      expect(screen.getByTestId("route-name")).toHaveTextContent(
        "Route: search",
      );
    });

    it("RankingRoute ストーリーがランキング画面ルートを描画すること (SCR-07)", () => {
      render(<RankingRoute />);
      expect(screen.getByTestId("current-path")).toHaveTextContent(
        "Path: /ranking",
      );
      expect(screen.getByTestId("route-name")).toHaveTextContent(
        "Route: ranking",
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
      expect(screen.getByTestId("current-path")).toHaveTextContent(
        "Path: /settings",
      );
      expect(screen.getByTestId("route-name")).toHaveTextContent(
        "Route: settings",
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

  describe("matchRoute 関数検証", () => {
    it("ルートパス / は bookshelf ルートにマッチすること", () => {
      expect(matchRoute("/")).toEqual({ name: "bookshelf", path: "/" });
      expect(matchRoute("")).toEqual({ name: "bookshelf", path: "/" });
      expect(matchRoute("   ")).toEqual({ name: "bookshelf", path: "/" });
    });

    it("検索パス /search は search ルートにマッチすること (SCR-06)", () => {
      expect(matchRoute("/search")).toEqual({
        name: "search",
        path: "/search",
      });
      expect(matchRoute(" /search/ ")).toEqual({
        name: "search",
        path: "/search",
      });
    });

    it("ランキングパス /ranking は ranking ルートにマッチすること (SCR-07)", () => {
      expect(matchRoute("/ranking")).toEqual({
        name: "ranking",
        path: "/ranking",
      });
      expect(matchRoute(" /ranking/ ")).toEqual({
        name: "ranking",
        path: "/ranking",
      });
    });

    it("設定パス /settings は settings ルートにマッチすること (SCR-05)", () => {
      expect(matchRoute("/settings")).toEqual({
        name: "settings",
        path: "/settings",
      });
      expect(matchRoute(" /settings/ ")).toEqual({
        name: "settings",
        path: "/settings",
      });
    });

    it("作品詳細パス /novels/:novelId は novel-detail ルートにマッチすること (SCR-02)", () => {
      const result = matchRoute("/novels/kakuyomu%3A16817330658027210412");
      expect(result).toEqual({
        name: "novel-detail",
        path: "/novels/kakuyomu%3A16817330658027210412",
        novelId: "kakuyomu:16817330658027210412",
      });
    });

    it("作品詳細パスで末尾スラッシュがあっても正しくマッチすること", () => {
      const result = matchRoute("/novels/sample-novel-id/");
      expect(result).toEqual({
        name: "novel-detail",
        path: "/novels/sample-novel-id",
        novelId: "sample-novel-id",
      });
    });

    it("リーダーパス /novels/:novelId/chapters/:chapterIndex は reader ルートにマッチすること (SCR-03)", () => {
      const result = matchRoute(
        "/novels/kakuyomu%3A16817330658027210412/chapters/12",
      );
      expect(result).toEqual({
        name: "reader",
        path: "/novels/kakuyomu%3A16817330658027210412/chapters/12",
        novelId: "kakuyomu:16817330658027210412",
        chapterIndex: 12,
      });
    });

    it("リーダーパスで chapterIndex が 0 以下の場合は本棚ルートへフォールバックすること", () => {
      expect(matchRoute("/novels/work1/chapters/0")).toEqual({
        name: "bookshelf",
        path: "/",
      });
      expect(matchRoute("/novels/work1/chapters/-1")).toEqual({
        name: "bookshelf",
        path: "/",
      });
    });

    it("未知のパスや不正なパスは本棚ルートへフォールバックすること", () => {
      expect(matchRoute("/unknown/route")).toEqual({
        name: "bookshelf",
        path: "/",
      });
      expect(matchRoute("/novels//chapters/1")).toEqual({
        name: "bookshelf",
        path: "/",
      });
    });
  });

  describe("safeDecodeURIComponent 関数検証", () => {
    it("正常なエンコード文字列をデコードできること", () => {
      expect(safeDecodeURIComponent("kakuyomu%3A123")).toBe("kakuyomu:123");
      expect(safeDecodeURIComponent("hello%20world")).toBe("hello world");
    });

    it("不正なパーセントエンコード文字列の場合は元の文字列を返すこと", () => {
      expect(safeDecodeURIComponent("%E0%A4%A")).toBe("%E0%A4%A");
      expect(safeDecodeURIComponent("%")).toBe("%");
    });
  });

  describe("resolveInitialPath 関数検証", () => {
    it("initialPath が指定されている場合はそれを優先すること", () => {
      expect(resolveInitialPath("/custom", "/fallback")).toBe("/custom");
      expect(resolveInitialPath("/custom", undefined)).toBe("/custom");
    });

    it("initialPath がなく fallbackPath がある場合は fallbackPath を返すこと", () => {
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
          <span data-testid="previous-path-display">
            {router.previousPath ?? "none"}
          </span>
          <span data-testid="origin-display">
            {router.novelOrigin ?? "null"}
          </span>
          <button
            data-testid="btn-bookshelf"
            onClick={() => router.navigateToBookshelf()}
          >
            本棚
          </button>
          <button
            data-testid="btn-search"
            onClick={() => router.navigateToSearch()}
          >
            検索
          </button>
          <button
            data-testid="btn-ranking"
            onClick={() => router.navigateToRanking()}
          >
            ランキング
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

    it("navigateToBookshelf, navigateToSearch, navigateToRanking, navigateToNovelDetail, navigateToReader, navigateToSettings, navigate で画面遷移できること", () => {
      render(
        <RouterProvider initialPath="/">
          <TestConsumer />
        </RouterProvider>,
      );

      expect(screen.getByTestId("path-display")).toHaveTextContent("/");
      expect(screen.getByTestId("route-display")).toHaveTextContent(
        "bookshelf",
      );

      // 検索へ
      act(() => {
        screen.getByTestId("btn-search").click();
      });
      expect(screen.getByTestId("path-display")).toHaveTextContent("/search");
      expect(screen.getByTestId("route-display")).toHaveTextContent("search");
      expect(screen.getByTestId("previous-path-display")).toHaveTextContent(
        "/",
      );

      // ランキングへ
      act(() => {
        screen.getByTestId("btn-ranking").click();
      });
      expect(screen.getByTestId("path-display")).toHaveTextContent("/ranking");
      expect(screen.getByTestId("route-display")).toHaveTextContent("ranking");
      expect(screen.getByTestId("previous-path-display")).toHaveTextContent(
        "/search",
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
      expect(screen.getByTestId("previous-path-display")).toHaveTextContent(
        "/ranking",
      );

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

    it("同一パスへの navigate は履歴 pushState および previousPath の上書きを行わないこと（R1-21）", () => {
      const pushStateSpy = vi.spyOn(window.history, "pushState");

      render(
        <RouterProvider initialPath="/novels/kakuyomu%3A16817330658027210412">
          <TestConsumer />
        </RouterProvider>,
      );

      // 設定画面へ移動
      act(() => {
        screen.getByTestId("btn-settings").click();
      });
      expect(screen.getByTestId("path-display")).toHaveTextContent("/settings");
      expect(screen.getByTestId("previous-path-display")).toHaveTextContent(
        "/novels/kakuyomu%3A16817330658027210412",
      );
      const pushCountAfterFirstNavigate = pushStateSpy.mock.calls.length;

      // すでに /settings にいる状態で再度設定ボタンを押下
      act(() => {
        screen.getByTestId("btn-settings").click();
      });

      // pushState が追加で呼ばれず、previousPath も元のまま保持されること
      expect(pushStateSpy.mock.calls.length).toBe(pushCountAfterFirstNavigate);
      expect(screen.getByTestId("path-display")).toHaveTextContent("/settings");
      expect(screen.getByTestId("previous-path-display")).toHaveTextContent(
        "/novels/kakuyomu%3A16817330658027210412",
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
      it("各話View (SCR-03) から back() を呼んだとき、親である目次画面 (SCR-02) へ遷移すること (TR-06)", () => {
        render(
          <RouterProvider initialPath="/novels/work1/chapters/3">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });

        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/work1",
        );
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "novel-detail",
        );
      });

      it("目次画面 (SCR-02) で直前の探索元が検索画面 (/search) の場合、back() で /search へ復帰すること (TR-07)", () => {
        render(
          <RouterProvider initialPath="/search">
            <TestConsumer />
          </RouterProvider>,
        );

        // /search から詳細へ
        act(() => {
          screen.getByTestId("btn-detail").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412",
        );

        // 戻る
        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/search");
        expect(screen.getByTestId("route-display")).toHaveTextContent("search");
      });

      it("目次画面 (SCR-02) で直前の探索元がランキング画面 (/ranking) の場合、back() で /ranking へ復帰すること (TR-07)", () => {
        render(
          <RouterProvider initialPath="/ranking">
            <TestConsumer />
          </RouterProvider>,
        );

        // /ranking から詳細へ
        act(() => {
          screen.getByTestId("btn-detail").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412",
        );

        // 戻る
        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/ranking",
        );
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "ranking",
        );
      });

      it("目次画面 (SCR-02) で探索元からリーダーへ進んだ後でも、リーダー戻り後の再度 back() で元の探索元へ復帰すること (TR-06, TR-07)", () => {
        render(
          <RouterProvider initialPath="/ranking">
            <TestConsumer />
          </RouterProvider>,
        );

        // /ranking -> 詳細 -> リーダー
        act(() => {
          screen.getByTestId("btn-detail").click();
        });
        act(() => {
          screen.getByTestId("btn-reader").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412/chapters/5",
        );

        // リーダーから目次へ戻る
        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412",
        );

        // 目次から再度戻ると、元の探索元である /ranking へ復帰すること
        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/ranking",
        );
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "ranking",
        );
      });

      it("目次画面 (SCR-02) に直接アクセスした場合（履歴なし）、back() で本棚画面 (/) へ復帰すること (TR-07)", () => {
        render(
          <RouterProvider initialPath="/novels/work1">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });

        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "bookshelf",
        );
      });

      it("リーダー画面 (/novels/:novelId/chapters/:chapterIndex) から設定画面へ遷移後、back() でリーダー画面へ復帰すること (TR-12)", () => {
        render(
          <RouterProvider initialPath="/novels/kakuyomu:16817330658027210412/chapters/5">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-settings").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/settings",
        );
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "settings",
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu:16817330658027210412/chapters/5",
        );
        expect(screen.getByTestId("route-display")).toHaveTextContent("reader");
      });

      it("作品詳細画面 (/novels/:novelId) から設定画面へ遷移後、back() で作品詳細画面へ復帰すること (TR-12)", () => {
        render(
          <RouterProvider initialPath="/novels/kakuyomu:16817330658027210412">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-settings").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/settings",
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu:16817330658027210412",
        );
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "novel-detail",
        );
      });

      it("本棚画面 (/) から設定画面へ遷移後、back() で本棚画面 (/) へ復帰すること (TR-12)", () => {
        render(
          <RouterProvider initialPath="/">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-settings").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/settings",
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "bookshelf",
        );
      });

      it("検索画面 (/search) から設定画面へ遷移後、back() で本棚画面 (/) へ復帰すること (TR-12)", () => {
        render(
          <RouterProvider initialPath="/search">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-settings").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/settings",
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "bookshelf",
        );
      });

      it("ランキング画面 (/ranking) から設定画面へ遷移後、back() で本棚画面 (/) へ復帰すること (TR-12)", () => {
        render(
          <RouterProvider initialPath="/ranking">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-settings").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/settings",
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "bookshelf",
        );
      });

      it("初期パス /settings で起動時（履歴なし）、back() で本棚画面 (/) へ復帰すること (TR-12)", () => {
        render(
          <RouterProvider initialPath="/settings">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "bookshelf",
        );
      });

      it("リーダー画面から設定画面へ遷移した後に別のタブ（例: /ranking）へ遷移した場合、settingsOrigin がリセットされ、ランキングからの back() は本棚 (/) へ遷移すること", () => {
        render(
          <RouterProvider initialPath="/novels/kakuyomu:16817330658027210412/chapters/5">
            <TestConsumer />
          </RouterProvider>,
        );

        // リーダー -> 設定
        act(() => {
          screen.getByTestId("btn-settings").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/settings",
        );

        // 設定 -> ランキング
        act(() => {
          screen.getByTestId("btn-ranking").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/ranking",
        );

        // ランキング -> back() -> 本棚
        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "bookshelf",
        );
      });

      it("検索画面 (/search) から作品詳細・リーダーへ遷移後、設定画面を開いて back() でリーダーへ戻り、リーダーから back() で作品詳細へ戻り、作品詳細から back() で検索画面 (/search) へ戻れること（novelOrigin 探索元コンテキスト保護）", () => {
        render(
          <RouterProvider initialPath="/search">
            <TestConsumer />
          </RouterProvider>,
        );

        // 検索 -> 作品詳細 (origin: /search)
        act(() => {
          screen.getByTestId("btn-detail").click();
        });
        expect(screen.getByTestId("origin-display")).toHaveTextContent(
          "/search",
        );

        // 作品詳細 -> リーダー
        act(() => {
          screen.getByTestId("btn-reader").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412/chapters/5",
        );

        // リーダー -> 設定
        act(() => {
          screen.getByTestId("btn-settings").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/settings",
        );

        // 設定 -> back() -> リーダー復帰
        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412/chapters/5",
        );
        expect(screen.getByTestId("route-display")).toHaveTextContent("reader");

        // リーダー -> back() -> 作品詳細復帰 (TR-06)
        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent(
          "/novels/kakuyomu%3A16817330658027210412",
        );
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "novel-detail",
        );

        // 作品詳細 -> back() -> 探索元 /search 復帰 (TR-07)
        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/search");
        expect(screen.getByTestId("route-display")).toHaveTextContent("search");
      });

      it("検索画面 (SCR-06) から back() を呼んだとき、ホーム本棚画面 (/) へ復帰すること (TR-12)", () => {
        render(
          <RouterProvider initialPath="/search">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "bookshelf",
        );
      });

      it("ランキング画面 (SCR-07) から back() を呼んだとき、ホーム本棚画面 (/) へ復帰すること (TR-12)", () => {
        render(
          <RouterProvider initialPath="/ranking">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "bookshelf",
        );
      });

      it("本棚画面 (SCR-01) で back() を呼んだ場合、論理親がないためパスが変わらないこと (TR-13)", () => {
        render(
          <RouterProvider initialPath="/">
            <TestConsumer />
          </RouterProvider>,
        );

        act(() => {
          screen.getByTestId("btn-back").click();
        });
        expect(screen.getByTestId("path-display")).toHaveTextContent("/");
        expect(screen.getByTestId("route-display")).toHaveTextContent(
          "bookshelf",
        );
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
        expect(pushSpy).toHaveBeenCalledWith(
          null,
          "",
          "/novels/kakuyomu%3A16817330658027210412",
        );
        expect(pushSpy).toHaveBeenCalledWith(
          null,
          "",
          "/novels/kakuyomu%3A16817330658027210412/chapters/5",
        );

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

      describe("novelOrigin の追跡と公開", () => {
        it("初期状態では novelOrigin は null であること", () => {
          render(
            <RouterProvider initialPath="/">
              <TestConsumer />
            </RouterProvider>,
          );
          expect(screen.getByTestId("origin-display")).toHaveTextContent(
            "null",
          );
        });

        it("検索画面 (/search) から作品詳細画面へ遷移したとき、novelOrigin が /search となること", () => {
          render(
            <RouterProvider initialPath="/search">
              <TestConsumer />
            </RouterProvider>,
          );
          expect(screen.getByTestId("origin-display")).toHaveTextContent(
            "null",
          );

          act(() => {
            screen.getByTestId("btn-detail").click();
          });
          expect(screen.getByTestId("origin-display")).toHaveTextContent(
            "/search",
          );
        });

        it("ランキング画面 (/ranking) から作品詳細画面へ遷移したとき、novelOrigin が /ranking となること", () => {
          render(
            <RouterProvider initialPath="/ranking">
              <TestConsumer />
            </RouterProvider>,
          );
          expect(screen.getByTestId("origin-display")).toHaveTextContent(
            "null",
          );

          act(() => {
            screen.getByTestId("btn-detail").click();
          });
          expect(screen.getByTestId("origin-display")).toHaveTextContent(
            "/ranking",
          );
        });

        it("探索元から詳細を経てリーダーへ進んだ際も novelOrigin が維持され、設定画面へ遷移すると null にリセットされること", () => {
          render(
            <RouterProvider initialPath="/search">
              <TestConsumer />
            </RouterProvider>,
          );

          act(() => {
            screen.getByTestId("btn-detail").click();
          });
          expect(screen.getByTestId("origin-display")).toHaveTextContent(
            "/search",
          );

          act(() => {
            screen.getByTestId("btn-reader").click();
          });
          expect(screen.getByTestId("origin-display")).toHaveTextContent(
            "/search",
          );

          act(() => {
            screen.getByTestId("btn-settings").click();
          });
          expect(screen.getByTestId("origin-display")).toHaveTextContent(
            "null",
          );
        });

        it("fromBookshelfResume でリーダーへ遷移した場合は novelOrigin が / となること", () => {
          render(
            <RouterProvider initialPath="/">
              <TestConsumer />
            </RouterProvider>,
          );

          act(() => {
            screen.getByTestId("btn-reader-resume").click();
          });
          expect(screen.getByTestId("origin-display")).toHaveTextContent("/");
        });
      });
    });
  });
});
