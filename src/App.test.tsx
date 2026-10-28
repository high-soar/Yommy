import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./App.stories";
import { App } from "./App";
import { resetTestDb } from "./storage/adapter/inMemoryDb";

const { Default, SettingsRoute, NovelDetailRoute, ReaderRoute } =
  composeStories(stories);

describe("App コンポーネント", () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetTestDb();
    window.history.pushState(null, "", "/");
  });

  describe("Storybook ストーリーのレンダリング検証 (composeStories)", () => {
    it("Default ストーリー: 全画面シェル内に本棚画面と下部タブバー（本棚アクティブ）を描画する", async () => {
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
      expect(screen.getByTestId("tab-settings")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("SettingsRoute ストーリー: 設定画面と下部タブバー（設定アクティブ）を描画する", async () => {
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
    });

    it("NovelDetailRoute ストーリー: 作品詳細・目次画面と下部タブバー（本棚アクティブ）を描画する", async () => {
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
  });

  describe("ルーティングと下部タブナビゲーション操作の検証", () => {
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
});
