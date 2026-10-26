import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./App.stories";
import { App } from "./App";
import { resetTestDb } from "./storage/adapter/inMemoryDb";

const { Default, CustomTitle, NovelDetailRoute, ReaderRoute } =
  composeStories(stories);

describe("App コンポーネント", () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetTestDb();
    window.history.pushState(null, "", "/");
  });

  describe("Storybook ストーリーのレンダリング検証 (composeStories)", () => {
    it("Default ストーリー: 本棚画面（空状態）とデフォルトタイトル Yommy を描画する", async () => {
      render(<Default />);

      expect(screen.getByTestId("app-title")).toHaveTextContent("Yommy");
      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
        expect(screen.getByTestId("bookshelf-empty")).toBeInTheDocument();
      });
    });

    it("CustomTitle ストーリー: 指定されたカスタムタイトルを描画する", async () => {
      render(<CustomTitle />);

      expect(screen.getByTestId("app-title")).toHaveTextContent(
        "Yommy Web Novel Reader",
      );
      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("NovelDetailRoute ストーリー: 作品詳細・目次画面を描画する", async () => {
      render(<NovelDetailRoute />);

      expect(screen.getByTestId("app-title")).toHaveTextContent("Yommy");
      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      });
    });

    it("ReaderRoute ストーリー: リーダー画面を描画する", async () => {
      render(<ReaderRoute />);

      expect(screen.getByTestId("app-title")).toHaveTextContent("Yommy");
      await waitFor(
        () => {
          expect(screen.getByTestId("reader-page")).toBeInTheDocument();
          expect(screen.getByTestId("reader-toolbar")).toBeInTheDocument();
          expect(
            screen.getByTestId("reader-back-to-bookshelf"),
          ).toBeInTheDocument();
          expect(
            screen.getByTestId("reader-back-to-detail"),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });

  describe("ルーティングとナビゲーション操作の検証", () => {
    it("ヘッダータイトルをクリックすると本棚画面へ遷移する", async () => {
      const user = userEvent.setup();
      render(
        <App
          title="Yommy"
          initialPath="/novels/kakuyomu:16817330658027210412"
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("app-title"));

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("Props 未指定時にデフォルト値で本棚画面が描画される", async () => {
      render(<App />);

      expect(screen.getByTestId("app-title")).toHaveTextContent("Yommy");
      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("リーダー画面で「本棚へ戻る」をクリックすると本棚画面へ遷移する", async () => {
      const user = userEvent.setup();
      render(
        <App initialPath="/novels/kakuyomu:16817330658027210412/chapters/1" />,
      );

      await waitFor(
        () => {
          expect(
            screen.getByTestId("reader-back-to-bookshelf"),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await user.click(screen.getByTestId("reader-back-to-bookshelf"));

      await waitFor(() => {
        expect(screen.getByTestId("bookshelf-page")).toBeInTheDocument();
      });
    });

    it("リーダー画面で「作品詳細へ」をクリックすると作品詳細画面へ遷移する", async () => {
      const user = userEvent.setup();
      render(
        <App initialPath="/novels/kakuyomu:16817330658027210412/chapters/1" />,
      );

      await waitFor(
        () => {
          expect(
            screen.getByTestId("reader-back-to-detail"),
          ).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      await user.click(screen.getByTestId("reader-back-to-detail"));

      await waitFor(() => {
        expect(screen.getByTestId("novel-detail-page")).toBeInTheDocument();
      });
    });

    it("カスタム initialWorkUrl が渡された場合にも正常に動作する", async () => {
      render(
        <App
          initialPath="/novels/kakuyomu:16817330658027210412/chapters/1"
          initialWorkUrl="https://kakuyomu.jp/works/16817330658027210412"
        />,
      );

      await waitFor(
        () => {
          expect(screen.getByTestId("reader-toolbar")).toBeInTheDocument();
        },
        { timeout: 3000 },
      );
    });
  });
});
