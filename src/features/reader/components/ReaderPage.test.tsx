import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderPage.stories";
import { ReaderPage, type ReaderPageProps } from "./ReaderPage";
import type { NovelRecord, ChapterRecord } from "../../../storage/types";

const { Default, OverlayOpen, HorizontalSepia, Loading, ErrorState, Empty } =
  composeStories(stories);

const sampleNovel: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "異界から迷い込んだ青年が紡ぐファンタジー戦記。",
  totalChapters: 3,
  cachedChapters: 2,
  totalByteSize: 10240,
  bookmarkChapterIndex: 1,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-10-25T10:00:00Z",
  updatedAt: "2026-10-26T07:00:00Z",
};

const sampleChapter: ChapterRecord = {
  id: "kakuyomu:16817330658027210412:1",
  novelId: "kakuyomu:16817330658027210412",
  chapterIndex: 1,
  remoteChapterId: "1",
  partTitle: "第一部 旅立ち",
  title: "第1話 見知らぬ空",
  url: "https://kakuyomu.jp/works/16817330658027210412/episodes/1",
  bodyHtml: "<p>本文テキスト</p>",
  byteSize: 1024,
  isRead: true,
  publishedAt: "2026-01-01T10:00:00Z",
  downloadedAt: "2026-01-01T12:00:00Z",
};

function createDefaultProps(
  overrides: Partial<ReaderPageProps> = {},
): ReaderPageProps {
  return {
    novel: sampleNovel,
    chapter: sampleChapter,
    chapterIndex: 1,
    totalChapters: 3,
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    initialScrollProgress: 0,
    isLoading: false,
    error: null,
    onPrevChapter: vi.fn(),
    onNextChapter: vi.fn(),
    onScrollProgressChange: vi.fn(),
    onSelectTab: vi.fn(),
    ...overrides,
  };
}

function firePointer(
  element: HTMLElement,
  type: "pointerdown" | "pointerup" | "pointercancel",
  init: { clientX?: number; clientY?: number } = {},
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  });
  fireEvent(element, event);
}

describe("ReaderPage", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで全画面本文と最下部タッチゾーンが描画され、オーバーレイは初期非表示（AC-RD-09）", () => {
      render(<Default />);
      const page = screen.getByTestId("reader-page");
      expect(page).toBeInTheDocument();
      expect(page).toHaveClass("h-dvh");
      expect(page).toHaveClass("w-full");
      expect(page).toHaveClass("overflow-hidden");

      // 常時表示ツールバーおよび章ナビが廃止されていること
      expect(screen.queryByTestId("reader-toolbar")).not.toBeInTheDocument();

      // 本文全画面描画
      expect(screen.getByTestId("reader-view")).toBeInTheDocument();

      // 最下部タッチゾーン
      expect(
        screen.getByTestId("reader-bottom-touch-zone"),
      ).toBeInTheDocument();

      // 下部オーバーレイは初期非表示（aria-hidden=true）
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("aria-hidden", "true");
      expect(overlay).toHaveClass("translate-y-full");
    });

    it("OverlayOpen ストーリーで下部オーバーレイが展開表示されていること", () => {
      render(<OverlayOpen />);
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toHaveAttribute("aria-hidden", "false");
      expect(overlay).toHaveClass("translate-y-0");
    });

    it("HorizontalSepia ストーリーで横書き・セピアの ReaderView が描画されること", () => {
      render(<HorizontalSepia />);
      const view = screen.getByTestId("reader-view");
      expect(view).toHaveAttribute("data-writing-mode", "horizontal-tb");
      expect(view).toHaveAttribute("data-theme", "sepia");
    });

    it("Loading ストーリーでローディング表示が描画され本文や空状態が非表示となること", () => {
      render(<Loading />);
      expect(screen.getByTestId("reader-loading")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-empty")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-error")).not.toBeInTheDocument();
    });

    it("ErrorState ストーリーでエラーアラートが描画され下部オーバーレイが初期展開表示されること（AC-RD-10）", () => {
      render(<ErrorState />);
      const errorEl = screen.getByTestId("reader-error");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveAttribute("role", "alert");
      expect(errorEl).toHaveTextContent("エピソード本文の取得に失敗しました");
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();

      // エラー時は初期状態でオーバーレイが展開表示
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toHaveAttribute("aria-hidden", "false");
      expect(overlay).toHaveClass("translate-y-0");
    });

    it("Empty ストーリーで空状態が描画され下部オーバーレイが初期展開表示されること（AC-RD-10）", () => {
      render(<Empty />);
      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();

      // 空状態時は初期状態でオーバーレイが展開表示
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toHaveAttribute("aria-hidden", "false");
      expect(overlay).toHaveClass("translate-y-0");
    });
  });

  describe("状態別排他描画ルールの検証", () => {
    it("error が存在する場合は isLoading が true であってもエラー表示が優先されること", () => {
      const props = createDefaultProps({
        error: "致命的なネットワークエラー",
        isLoading: true,
      });
      render(<ReaderPage {...props} />);

      expect(screen.getByTestId("reader-error")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-loading")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-view")).not.toBeInTheDocument();
      expect(screen.getByTestId("reader-bottom-overlay")).toHaveAttribute(
        "aria-hidden",
        "false",
      );
    });

    it("isLoading が true であっても既に chapter.bodyHtml が存在する場合は ReaderView が維持されること", () => {
      const props = createDefaultProps({
        isLoading: true,
      });
      render(<ReaderPage {...props} />);

      expect(screen.getByTestId("reader-view")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-loading")).not.toBeInTheDocument();
    });

    it("novel === null のとき空状態となり、オーバーレイが初期展開されること", () => {
      const props = createDefaultProps({
        novel: null,
      });
      render(<ReaderPage {...props} />);

      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      expect(screen.getByTestId("reader-bottom-overlay")).toHaveAttribute(
        "aria-hidden",
        "false",
      );
    });

    it("chapter === null または chapter.bodyHtml === null のとき空状態が描画されること", () => {
      const { rerender } = render(
        <ReaderPage {...createDefaultProps({ chapter: null })} />,
      );
      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();

      rerender(
        <ReaderPage
          {...createDefaultProps({
            chapter: { ...sampleChapter, bodyHtml: null },
          })}
        />,
      );
      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
    });
  });

  describe("最下部タッチゾーンによるオーバーレイ開閉制御（AC-RD-10）", () => {
    it("最下部タッチゾーンをタップ（移動10px未満・500ms未満）するとオーバーレイが表示され、再タップで非表示になること", () => {
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      const overlay = screen.getByTestId("reader-bottom-overlay");

      expect(overlay).toHaveAttribute("aria-hidden", "true");

      // 1回目のタップ（展開）
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      vi.spyOn(Date, "now").mockReturnValue(now + 100);
      firePointer(touchZone, "pointerup", { clientX: 102, clientY: 503 });

      expect(overlay).toHaveAttribute("aria-hidden", "false");
      expect(overlay).toHaveClass("translate-y-0");

      // 2回目のタップ（閉じる）
      vi.spyOn(Date, "now").mockReturnValue(now + 200);
      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      vi.spyOn(Date, "now").mockReturnValue(now + 250);
      firePointer(touchZone, "pointerup", { clientX: 100, clientY: 500 });

      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });

    it("タッチ移動距離が10px以上のスワイプ・ドラッグ操作ではオーバーレイが開かないこと", () => {
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      const overlay = screen.getByTestId("reader-bottom-overlay");

      expect(overlay).toHaveAttribute("aria-hidden", "true");

      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      // 上方向へ20pxスワイプ
      vi.spyOn(Date, "now").mockReturnValue(now + 80);
      firePointer(touchZone, "pointerup", { clientX: 100, clientY: 480 });

      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });

    it("タッチ時間が500ms以上の長押し操作ではオーバーレイが開かないこと", () => {
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      const overlay = screen.getByTestId("reader-bottom-overlay");

      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      // 600ms経過
      vi.spyOn(Date, "now").mockReturnValue(now + 600);
      firePointer(touchZone, "pointerup", { clientX: 100, clientY: 500 });

      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });

    it("pointercancel が発生した場合はその後の pointerup でオーバーレイが開かないこと", () => {
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      const overlay = screen.getByTestId("reader-bottom-overlay");

      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      firePointer(touchZone, "pointercancel");
      firePointer(touchZone, "pointerup", { clientX: 100, clientY: 500 });

      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });

    it("キーボード操作（Enter / Space）でオーバーレイの開閉がトグルされること", () => {
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      const overlay = screen.getByTestId("reader-bottom-overlay");

      fireEvent.keyDown(touchZone, { key: "Enter" });
      expect(overlay).toHaveAttribute("aria-hidden", "false");

      fireEvent.keyDown(touchZone, { key: " " });
      expect(overlay).toHaveAttribute("aria-hidden", "true");

      // その他のキーでは反応しないこと
      fireEvent.keyDown(touchZone, { key: "Tab" });
      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("自動非表示（Auto-Hide）トリガーの検証（AC-RD-10）", () => {
    it("オーバーレイ展開中に本文スクロールが発生した際に自動的に閉じること", async () => {
      const onScrollProgressChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            onScrollProgressChange,
          })}
        />,
      );
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toHaveAttribute("aria-hidden", "false");

      const readerView = screen.getByTestId("reader-view");
      Object.defineProperty(readerView, "scrollWidth", {
        value: 1000,
        configurable: true,
      });
      Object.defineProperty(readerView, "clientWidth", {
        value: 500,
        configurable: true,
      });
      Object.defineProperty(readerView, "scrollLeft", {
        value: -200,
        configurable: true,
      });

      await act(async () => {
        readerView.dispatchEvent(new Event("scroll"));
      });

      expect(onScrollProgressChange).toHaveBeenCalled();
      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });

    it("オーバーレイ展開中に本文エリアをクリックした際に自動的に閉じること", async () => {
      const user = userEvent.setup();
      render(
        <ReaderPage {...createDefaultProps({ initialOverlayOpen: true })} />,
      );
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toHaveAttribute("aria-hidden", "false");

      await user.click(screen.getByTestId("reader-view"));
      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });

    it("オーバーレイ展開中に「前の話へ」をクリックすると onPrevChapter が呼ばれ自動的に閉じること", async () => {
      const user = userEvent.setup();
      const onPrevChapter = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            chapterIndex: 2,
            initialOverlayOpen: true,
            onPrevChapter,
          })}
        />,
      );
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toHaveAttribute("aria-hidden", "false");

      await user.click(screen.getByTestId("reader-prev-chapter"));
      expect(onPrevChapter).toHaveBeenCalledTimes(1);
      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });

    it("オーバーレイ展開中に「次の話へ」をクリックすると onNextChapter が呼ばれ自動的に閉じること", async () => {
      const user = userEvent.setup();
      const onNextChapter = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            chapterIndex: 1,
            initialOverlayOpen: true,
            onNextChapter,
          })}
        />,
      );
      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toHaveAttribute("aria-hidden", "false");

      await user.click(screen.getByTestId("reader-next-chapter"));
      expect(onNextChapter).toHaveBeenCalledTimes(1);
      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });

    it("下部タブ（本棚 / 設定）をクリックした際に onSelectTab が呼ばれること", async () => {
      const user = userEvent.setup();
      const onSelectTab = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            onSelectTab,
          })}
        />,
      );

      await user.click(screen.getByTestId("reader-bottom-tab-bookshelf"));
      expect(onSelectTab).toHaveBeenCalledWith("bookshelf");

      await user.click(screen.getByTestId("reader-bottom-tab-settings"));
      expect(onSelectTab).toHaveBeenCalledWith("settings");
    });

    it("activeTab が指定された場合、ReaderBottomOverlay に反映され対応するタブがアクティブとなること", () => {
      const { rerender } = render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            activeTab: "search",
          })}
        />,
      );

      expect(screen.getByTestId("reader-bottom-tab-search")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("reader-bottom-tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "false",
      );

      rerender(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            activeTab: "ranking",
          })}
        />,
      );

      expect(screen.getByTestId("reader-bottom-tab-ranking")).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(screen.getByTestId("reader-bottom-tab-search")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });
  });
});
