import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      expect(
        screen.getByTestId("reader-body").querySelector("ruby"),
      ).toBeInTheDocument();
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
      const readerBody = screen.getByTestId("reader-body");
      expect(readerBody.querySelector("ruby")).toBeInTheDocument();
      expect(readerBody.querySelector("em.bouten")).toBeInTheDocument();
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

      // 再度クリックして縦書きに戻す
      await user.click(screen.getByTestId("toggle-orientation"));
      expect(screen.getByTestId("reader-view")).toHaveClass(
        "writing-vertical-rl",
      );

      // セピアテーマに切替
      await user.click(screen.getByTestId("theme-sepia"));
      expect(screen.getByTestId("reader-view")).toHaveClass("bg-[#fbf0d9]");
    });

    it("作品取得時に非Error例外がスローされた場合も文字列としてエラー表示されること", async () => {
      const user = userEvent.setup();
      const failingHttp: HttpClientBridge = {
        getHtml: vi.fn().mockRejectedValue("ネットワーク接続エラー文字列"),
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
          "ネットワーク接続エラー文字列",
        );
      });
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

    it("目次が0件の作品を取得した場合は本文未取得として空チャプターが表示されること", async () => {
      const user = userEvent.setup();
      const emptyWorkHtml = `<!doctype html><html><head><link rel="canonical" href="https://kakuyomu.jp/works/1177354054881162325" /></head><body><div id="container"><header id="workHeader"><h1 id="workTitle">エピソードなし作品</h1><h2 id="workAuthor-activityName">著者</h2></header><div class="widget-toc-main"></div></div></body></html>`;

      const emptyTocHttp: HttpClientBridge = {
        getHtml: vi.fn().mockResolvedValue({
          status: 200,
          url: "https://kakuyomu.jp/works/1177354054881162325",
          html: emptyWorkHtml,
          headers: {},
        }),
      };

      render(
        <ServiceProvider services={{ httpClient: emptyTocHttp }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("fetch-novel-button")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("fetch-novel-button"));

      await waitFor(() => {
        expect(screen.getByTestId("reader-title")).toHaveTextContent(
          "エピソードなし作品",
        );
      });
      expect(screen.getByTestId("reader-body")).toHaveTextContent(
        "本文がまだ取得されていません。",
      );
    });

    it("初期化時にエラーが発生した場合はエラーメッセージが表示されること", async () => {
      const failingRepo = {
        listNovels: vi
          .fn()
          .mockRejectedValue(new Error("初期化Errorインスタンス")),
        getNovelById: vi.fn(),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      render(
        <ServiceProvider services={{ novelRepository: failingRepo }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "初期化Errorインスタンス",
        );
      });
    });

    it("初期化時に非Error例外がスローされた場合も文字列としてエラー表示されること", async () => {
      const failingRepo = {
        listNovels: vi.fn().mockRejectedValue("非Error文字列例外"),
        getNovelById: vi.fn(),
        upsertNovelWithToc: vi.fn(),
        updateBookmark: vi.fn(),
        deleteNovel: vi.fn(),
      };

      render(
        <ServiceProvider services={{ novelRepository: failingRepo }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("reader-error")).toHaveTextContent(
          "非Error文字列例外",
        );
      });
    });

    it("初期設定で horizontal-tb および sepia が保存されている場合は正しく復元されること", async () => {
      const settingsRepo = {
        getReaderSettings: vi.fn().mockResolvedValue({
          writingMode: "horizontal-tb",
          theme: "sepia",
          fontFamily: "biz-ud-mincho",
          fontSizePx: 18,
          lineHeight: 1.8,
          pageMarginPx: 20,
          enableTapPaging: true,
          enableVolumeKeyPaging: false,
          updatedAt: "2026-01-01T00:00:00Z",
        }),
        updateReaderSettings: vi.fn(),
      };

      render(
        <ServiceProvider services={{ settingsRepository: settingsRepo }}>
          <PocReaderContainer />
        </ServiceProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("toggle-orientation")).toHaveTextContent(
          "縦書き表示に切替",
        );
      });
      expect(screen.getByTestId("theme-sepia")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });
});
