import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./App.stories";
import { App } from "./App";
import { MockAppBridge } from "./bridges/app/mockAppBridge";
import { resetTestDb } from "./storage/adapter/inMemoryDb";

const {
  Default,
  SearchRoute,
  RankingRoute,
  SettingsRoute,
  NovelDetailRoute,
  ReaderRoute,
  ExitToastRoute,
} = composeStories(stories);

describe("App コンポーネント", () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetTestDb();
    window.history.pushState(null, "", "/");
  });

  describe("Storybook ストーリーのレンダリング検証 (composeStories)", () => {
    it("Default ストーリー: 全画面シェル内に本棚画面と4タブバー（本棚アクティブ）を描画する", async () => {
      render(<Default />);

      const appRoot = screen.getByTestId("app-root");
      expect(appRoot).toBeInTheDocument();
      expect(appRoot).toHaveClass("h-dvh");

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
        expect(screen.getByTestId("bookshelf-empty")).toBeInTheDocument();
      });

      const tabBar = screen.getByTestId("bottom-tab-bar");
      expect(tabBar).toBeInTheDocument();
      expect(screen.getByTestId("tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("tab-search")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-ranking")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-settings")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("SearchRoute ストーリー: 検索画面と下部4タブバー（検索アクティブ）を描画する", async () => {
      render(<SearchRoute />);

      expect(screen.getByTestId("app-root")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId("search-placeholder")).toBeInTheDocument();
      });

      const tabBar = screen.getByTestId("bottom-tab-bar");
      expect(tabBar).toBeInTheDocument();
      expect(screen.getByTestId("tab-search")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-ranking")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-settings")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("RankingRoute ストーリー: ランキング画面と下部4タブバー（ランキングアクティブ）を描画する", async () => {
      render(<RankingRoute />);

      expect(screen.getByTestId("app-root")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId("ranking-placeholder")).toBeInTheDocument();
      });

      const tabBar = screen.getByTestId("bottom-tab-bar");
      expect(tabBar).toBeInTheDocument();
      expect(screen.getByTestId("tab-ranking")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-search")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-settings")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("SettingsRoute ストーリー: 設定画面と下部4タブバー（設定アクティブ）を描画する", async () => {
      render(<SettingsRoute />);

      expect(screen.getByTestId("app-root")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
        expect(
          screen.getByTestId("typography-settings-section"),
        ).toBeInTheDocument();
      });

      const tabBar = screen.getByTestId("bottom-tab-bar");
      expect(tabBar).toBeInTheDocument();
      expect(screen.getByTestId("tab-settings")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-search")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-ranking")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("NovelDetailRoute ストーリー: 作品詳細・目次画面と下部4タブバー（本棚アクティブ）を描画する", async () => {
      render(<NovelDetailRoute />);

      expect(screen.getByTestId("app-root")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      });

      const tabBar = screen.getByTestId("bottom-tab-bar");
      expect(tabBar).toBeInTheDocument();
      expect(screen.getByTestId("tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("tab-settings")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("ReaderRoute ストーリー: リーダー画面を描画し、常駐下部タブバーは非表示とする", async () => {
      render(<ReaderRoute />);

      expect(screen.getByTestId("app-root")).toBeInTheDocument();
      await waitFor(
        () => {
          expect(screen.getByTestId("reader-page")).toBeInTheDocument();
          expect(
            screen.getByTestId("reader-bottom-touch-zone"),
          ).toBeInTheDocument();
          expect(
            screen.getByTestId("reader-bottom-overlay"),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // リーダー画面では常駐 BottomTabBar は描画されない
      expect(screen.queryByTestId("bottom-tab-bar")).not.toBeInTheDocument();
    });

    it("ExitToastRoute ストーリー: 本棚画面で終了確認トーストが表示された状態を描画する", async () => {
      render(<ExitToastRoute />);

      expect(screen.getByTestId("app-root")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });

      const toast = screen.getByTestId("exit-app-toast");
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveTextContent("もう一度バックボタンを押すと終了します");
      expect(toast).toHaveAttribute("role", "status");
    });
  });

  describe("ルーティングと下部タブナビゲーション操作の検証", () => {
    it("下部タブバーの「検索」をクリックすると検索画面へ遷移する (TR-01)", async () => {
      const user = userEvent.setup();
      render(<App initialPath="/" />);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });

      const searchTab = screen.getByTestId("tab-search");
      await user.click(searchTab);

      await waitFor(() => {
        expect(screen.getByTestId("search-placeholder")).toBeInTheDocument();
      });
    });

    it("下部タブバーの「ランキング」をクリックするとランキング画面へ遷移する (TR-01)", async () => {
      const user = userEvent.setup();
      render(<App initialPath="/" />);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });

      const rankingTab = screen.getByTestId("tab-ranking");
      await user.click(rankingTab);

      await waitFor(() => {
        expect(screen.getByTestId("ranking-placeholder")).toBeInTheDocument();
      });
    });

    it("下部タブバーの「設定」をクリックすると設定画面へ遷移する (TR-01)", async () => {
      const user = userEvent.setup();
      render(<App initialPath="/" />);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });

      const settingsTab = screen.getByTestId("tab-settings");
      await user.click(settingsTab);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });
    });

    it("検索画面で下部タブバーの「本棚」をクリックすると本棚画面へ遷移する (TR-01b)", async () => {
      const user = userEvent.setup();
      render(<App initialPath="/search" />);

      await waitFor(() => {
        expect(screen.getByTestId("search-placeholder")).toBeInTheDocument();
      });

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      await user.click(bookshelfTab);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("ランキング画面で下部タブバーの「本棚」をクリックすると本棚画面へ遷移する (TR-01b)", async () => {
      const user = userEvent.setup();
      render(<App initialPath="/ranking" />);

      await waitFor(() => {
        expect(screen.getByTestId("ranking-placeholder")).toBeInTheDocument();
      });

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      await user.click(bookshelfTab);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("設定画面で下部タブバーの「本棚」をクリックすると本棚画面へ遷移する (TR-01b)", async () => {
      const user = userEvent.setup();
      render(<App initialPath="/settings" />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      await user.click(bookshelfTab);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("作品詳細画面で下部タブバーの「本棚」をクリックすると本棚画面へ遷移する (TR-01b)", async () => {
      const user = userEvent.setup();
      render(<App initialPath="/novels/kakuyomu:16817330658027210412" />);

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      });

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      await user.click(bookshelfTab);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("リーダー画面で下部オーバーレイの「本棚」タブをクリックすると本棚画面へ遷移する", async () => {
      const user = userEvent.setup();
      render(
        <App initialPath="/novels/kakuyomu:16817330658027210412/chapters/1" />,
      );

      await waitFor(
        () => {
          expect(
            screen.getByTestId("reader-bottom-touch-zone"),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await user.click(screen.getByTestId("reader-bottom-touch-zone"));

      await waitFor(() => {
        expect(
          screen.getByTestId("reader-bottom-tab-bookshelf"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-bottom-tab-bookshelf"));

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("リーダー画面で下部オーバーレイの「設定」タブをクリックすると設定画面へ遷移する", async () => {
      const user = userEvent.setup();
      render(
        <App initialPath="/novels/kakuyomu:16817330658027210412/chapters/1" />,
      );

      await waitFor(
        () => {
          expect(
            screen.getByTestId("reader-bottom-touch-zone"),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await user.click(screen.getByTestId("reader-bottom-touch-zone"));

      await waitFor(() => {
        expect(
          screen.getByTestId("reader-bottom-tab-settings"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-bottom-tab-settings"));

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });
    });

    it("リーダー画面で下部オーバーレイの「検索」タブをクリックすると検索画面へ遷移する", async () => {
      const user = userEvent.setup();
      render(
        <App initialPath="/novels/kakuyomu:16817330658027210412/chapters/1" />,
      );

      await waitFor(
        () => {
          expect(
            screen.getByTestId("reader-bottom-touch-zone"),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await user.click(screen.getByTestId("reader-bottom-touch-zone"));

      await waitFor(() => {
        expect(
          screen.getByTestId("reader-bottom-tab-search"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-bottom-tab-search"));

      await waitFor(() => {
        expect(screen.getByTestId("search-placeholder")).toBeInTheDocument();
      });
    });

    it("リーダー画面で下部オーバーレイの「ランキング」タブをクリックするとランキング画面へ遷移する", async () => {
      const user = userEvent.setup();
      render(
        <App initialPath="/novels/kakuyomu:16817330658027210412/chapters/1" />,
      );

      await waitFor(
        () => {
          expect(
            screen.getByTestId("reader-bottom-touch-zone"),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await user.click(screen.getByTestId("reader-bottom-touch-zone"));

      await waitFor(() => {
        expect(
          screen.getByTestId("reader-bottom-tab-ranking"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("reader-bottom-tab-ranking"));

      await waitFor(() => {
        expect(screen.getByTestId("ranking-placeholder")).toBeInTheDocument();
      });
    });

    it("リーダー画面で OS 戻る操作（popstate）を行うと作品詳細画面へ戻る", async () => {
      render(
        <App initialPath="/novels/kakuyomu:16817330658027210412/chapters/1" />,
      );

      await waitFor(
        () => {
          expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await act(async () => {
        window.history.pushState(
          null,
          "",
          "/novels/kakuyomu:16817330658027210412",
        );
        window.dispatchEvent(new PopStateEvent("popstate"));
      });

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      });
    });

    it("カスタム initialWorkUrl および props 省略時にも正常に動作する", async () => {
      render(
        <App
          initialPath="/novels/kakuyomu:16817330658027210412/chapters/1"
          initialWorkUrl="https://kakuyomu.jp/works/16817330658027210412"
        />,
      );

      await waitFor(
        () => {
          expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("実機システム戻るボタン（AppBridge）連携と論理階層遷移・終了UXの検証 (AC-AB-02〜06)", () => {
    it("リーダー画面 (SCR-03) で戻るボタン押下時、目次画面 (SCR-02) へ論理階層遷移すること (AC-AB-02, TR-06)", async () => {
      const mockAppBridge = new MockAppBridge();
      render(
        <App
          initialPath="/novels/kakuyomu:16817330658027210412/chapters/1"
          appBridge={mockAppBridge}
        />,
      );

      await waitFor(
        () => {
          expect(screen.getByTestId("reader-page")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      });
    });

    it("作品詳細・目次画面 (SCR-02) で戻るボタン押下時、本棚画面 (SCR-01) へ復帰すること (AC-AB-03, TR-07)", async () => {
      const mockAppBridge = new MockAppBridge();
      render(
        <App
          initialPath="/novels/kakuyomu:16817330658027210412"
          appBridge={mockAppBridge}
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      });

      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("設定画面 (SCR-05) で戻るボタン押下時、ホーム本棚画面 (SCR-01) へ復帰すること (AC-AB-04, TR-12)", async () => {
      const mockAppBridge = new MockAppBridge();
      render(<App initialPath="/settings" appBridge={mockAppBridge} />);

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("検索画面 (SCR-06) で戻るボタン押下時、ホーム本棚画面 (SCR-01) へ復帰すること (TR-12)", async () => {
      const mockAppBridge = new MockAppBridge();
      render(<App initialPath="/search" appBridge={mockAppBridge} />);

      await waitFor(() => {
        expect(screen.getByTestId("search-placeholder")).toBeInTheDocument();
      });

      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("ランキング画面 (SCR-07) で戻るボタン押下時、ホーム本棚画面 (SCR-01) へ復帰すること (TR-12)", async () => {
      const mockAppBridge = new MockAppBridge();
      render(<App initialPath="/ranking" appBridge={mockAppBridge} />);

      await waitFor(() => {
        expect(screen.getByTestId("ranking-placeholder")).toBeInTheDocument();
      });

      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("本棚画面 (SCR-01) で戻るボタン1回目押下時、終了せず確認トーストが表示され2秒後に自動消去されること (AC-AB-05, TR-13)", async () => {
      const mockAppBridge = new MockAppBridge();
      render(<App initialPath="/" appBridge={mockAppBridge} />);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("exit-app-toast")).not.toBeInTheDocument();

      // 1回目の戻るボタン押下
      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });

      expect(mockAppBridge.exitAppCalled).toBe(false);
      const toast = screen.getByTestId("exit-app-toast");
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveTextContent("もう一度バックボタンを押すと終了します");

      // 2000ms 経過でトーストが消えること
      await waitFor(
        () => {
          expect(
            screen.queryByTestId("exit-app-toast"),
          ).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });

    it("本棚画面 (SCR-01) で2秒以内に連続2回戻るボタンを押下した場合は exitApp が呼ばれること (AC-AB-06, TR-13)", async () => {
      const mockAppBridge = new MockAppBridge();
      render(<App initialPath="/" appBridge={mockAppBridge} />);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });

      // 1回目の押下
      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });
      expect(mockAppBridge.exitAppCalled).toBe(false);

      // 2秒以内の2回目押下
      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });
      expect(mockAppBridge.exitAppCalled).toBe(true);
      expect(screen.queryByTestId("exit-app-toast")).not.toBeInTheDocument();
    });

    it("本棚画面 (SCR-01) で2秒以上経過後に再度戻るボタンを押下した場合は exitApp は呼ばれず再度トーストが表示されること (TR-13)", async () => {
      const mockAppBridge = new MockAppBridge();
      render(<App initialPath="/" appBridge={mockAppBridge} />);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });

      // 1回目の戻るボタン押下
      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });
      expect(screen.getByTestId("exit-app-toast")).toBeInTheDocument();

      // 2000ms 経過してトーストが消えるのを待つ
      await waitFor(
        () => {
          expect(
            screen.queryByTestId("exit-app-toast"),
          ).not.toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      // 2秒以上経過後の2回目押下
      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });

      expect(mockAppBridge.exitAppCalled).toBe(false);
      expect(screen.getByTestId("exit-app-toast")).toBeInTheDocument();
    });

    it("コンポーネントがアンマウントされた際、バックボタンリスナーおよびトーストタイマーが破棄されること", async () => {
      const mockAppBridge = new MockAppBridge();
      const { unmount } = render(
        <App initialPath="/" appBridge={mockAppBridge} />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });

      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });
      expect(screen.getByTestId("exit-app-toast")).toBeInTheDocument();

      unmount();

      // アンマウント後は triggerBackButton を呼んでもエラーにならない
      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });
    });

    it("本棚で戻るボタン押下後、トースト表示中に設定画面へ遷移して戻るボタンを押下した際、トーストタイマーが解除され直前画面へ復帰すること", async () => {
      const user = userEvent.setup();
      const mockAppBridge = new MockAppBridge();
      render(<App initialPath="/" appBridge={mockAppBridge} />);

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });

      // 本棚で戻るボタン押下（トースト表示開始）
      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });
      expect(screen.getByTestId("exit-app-toast")).toBeInTheDocument();

      // トースト表示中に設定タブへ遷移
      await user.click(screen.getByTestId("tab-settings"));
      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });

      // 設定画面で戻るボタンを押下
      await act(async () => {
        await mockAppBridge.triggerBackButton();
      });

      // 本棚画面に復帰し、トーストが消去されていること
      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("exit-app-toast")).not.toBeInTheDocument();
    });
  });
});
