import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./PocReaderContainer.stories";
import { PocReaderContainer } from "./PocReaderContainer";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { resetTestDb } from "../../../storage/adapter/inMemoryDb";
import type { HttpClientBridge } from "../../../bridges/http/types";

const { Empty, WithLoadedNovel } = composeStories(stories);

describe("PocReaderContainer", () => {
  beforeEach(async () => {
    await resetTestDb();
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Empty ストーリーで未取得時の空状態メッセージが表示されること", async () => {
      render(<Empty />);
      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });
      expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
    });

    it("WithLoadedNovel ストーリーで保存済み作品と本文が表示されること", async () => {
      render(<WithLoadedNovel />);
      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "第1話 見知らぬ空",
      );
      expect(screen.getByTestId("reader-body")).toContainHTML("<ruby>");
    });
  });

  describe("作品取得・DB永続化フローの検証", () => {
    it("「作品取得」ボタンをクリックしたときに作品トップと第1話が取得・保存・表示されること", async () => {
      const user = userEvent.setup();
      render(
        <ServiceProvider>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      // 初回は空状態
      await waitFor(() => {
        expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      });

      // 作品取得ボタンをクリック
      const fetchButton = screen.getByTestId("fetch-novel-button");
      await user.click(fetchButton);

      // 取得完了後にタイトルと本文が表示されること
      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "境界迷宮と異界の魔術師",
        );
      });
      expect(screen.getByTestId("reader-chapter-title")).toHaveTextContent(
        "プロローグ：目覚め",
      );
      expect(screen.getByTestId("reader-body")).toContainHTML("<ruby>");
      expect(screen.getByTestId("reader-body")).toContainHTML('class="bouten"');
    });

    it("設定（縦横切替・テーマ変更）が正しく反映されること", async () => {
      const user = userEvent.setup();
      render(
        <ServiceProvider>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      // 作品を取得
      await user.click(screen.getByTestId("fetch-novel-button"));
      await waitFor(() => {
        expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      });

      // 初期は縦書き
      expect(screen.getByTestId("reader-view")).toHaveClass(
        "writing-vertical-rl",
      );

      // 横書きに切替
      await user.click(screen.getByTestId("toggle-orientation"));
      expect(screen.getByTestId("reader-view")).toHaveClass(
        "writing-horizontal-tb",
      );

      // セピアテーマに切替
      await user.click(screen.getByTestId("theme-sepia"));
      expect(screen.getByTestId("reader-view")).toHaveClass("bg-[#fbf0d9]");
    });

    it("作品取得時に HTTP 通信エラーが発生した場合はエラーメッセージが表示されること", async () => {
      const user = userEvent.setup();
      const failingHttp: HttpClientBridge = {
        getHtml: vi.fn().mockRejectedValue(new Error("403 Forbidden")),
      };

      render(
        <ServiceProvider services={{ httpClient: failingHttp }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "403 Forbidden",
        );
      });
    });
  });
});
