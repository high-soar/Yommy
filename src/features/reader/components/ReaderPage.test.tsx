import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderPage.stories";
import { ReaderPage, type ReaderPageProps } from "./ReaderPage";
import type { NovelRecord, ChapterRecord } from "../../../storage/types";

const {
  Default,
  OverlayOpen,
  HorizontalSepia,
  Loading,
  ErrorState,
  Empty,
  Paged,
  ScrollMode,
  BoundaryHintNext,
  BoundaryHintPrev,
} = composeStories(stories);

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
    pagingMode: "auto",
    currentPage: 1,
    totalPages: 1,
    isLoading: false,
    error: null,
    onPrevChapter: vi.fn(),
    onNextChapter: vi.fn(),
    onPageChange: vi.fn(),
    onTotalPagesChange: vi.fn(),
    onScrollProgressChange: vi.fn(),
    onSelectTab: vi.fn(),
    ...overrides,
  };
}

function firePointer(
  element: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
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

    it("Paged ストーリーでページめくり組版およびページインジケーター（2 / 5）が表示されること（AC-RD-15, AC-RD-16）", () => {
      render(<Paged />);
      const view = screen.getByTestId("reader-view");
      expect(view).toHaveAttribute("data-paging-mode", "paged");
      expect(view).toHaveAttribute("data-effective-paging-mode", "paged");
      expect(view).toHaveAttribute("data-current-page", "2");
      expect(view).toHaveAttribute("data-total-pages", "5");

      const indicator = screen.getByTestId("reader-page-indicator");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveTextContent("2 / 5");
    });

    it("ScrollMode ストーリーで連続スクロールモードとして描画されること（AC-RD-15）", () => {
      render(<ScrollMode />);
      const view = screen.getByTestId("reader-view");
      expect(view).toHaveAttribute("data-paging-mode", "scroll");
      expect(view).toHaveAttribute("data-effective-paging-mode", "scroll");
      expect(
        screen.queryByTestId("reader-page-indicator"),
      ).not.toBeInTheDocument();
    });

    it("BoundaryHintNext ストーリーで次話案内ヒントバッジが表示されること（AC-RD-18）", () => {
      render(<BoundaryHintNext />);
      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("指を離して次の話へ");
    });

    it("BoundaryHintPrev ストーリーで前話案内ヒントバッジが表示されること（AC-RD-18）", () => {
      render(<BoundaryHintPrev />);
      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("指を離して前の話へ");
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
            pagingMode: "scroll",
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

  describe("ページネーション状態・コールバックの伝播検証 (AC-RD-15, AC-RD-16)", () => {
    it("明示的な pagingMode, currentPage, totalPages が ReaderView に伝播されること", () => {
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 3,
            totalPages: 10,
          })}
        />,
      );

      const view = screen.getByTestId("reader-view");
      expect(view).toHaveAttribute("data-paging-mode", "paged");
      expect(view).toHaveAttribute("data-current-page", "3");
      expect(view).toHaveAttribute("data-total-pages", "10");

      const indicator = screen.getByTestId("reader-page-indicator");
      expect(indicator).toHaveTextContent("3 / 10");
    });

    it("pagingMode, currentPage, totalPages 未指定時に既定値（auto, 1, 1）が適用されること", () => {
      const props = createDefaultProps();
      delete (props as Partial<ReaderPageProps>).pagingMode;
      delete (props as Partial<ReaderPageProps>).currentPage;
      delete (props as Partial<ReaderPageProps>).totalPages;

      render(<ReaderPage {...props} />);

      const view = screen.getByTestId("reader-view");
      expect(view).toHaveAttribute("data-paging-mode", "auto");
      // vertical-rl のため実効 paged となり 1 / 1
      expect(view).toHaveAttribute("data-current-page", "1");
      expect(view).toHaveAttribute("data-total-pages", "1");
      expect(screen.getByTestId("reader-page-indicator")).toHaveTextContent(
        "1 / 1",
      );
    });

    it("ReaderView からの onTotalPagesChange イベントが親へ伝播されること", () => {
      const onTotalPagesChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            onTotalPagesChange,
          })}
        />,
      );

      // ReaderView のマウント時 useEffect で clientWidth/scrollWidth に基づく onTotalPagesChange が発火
      expect(onTotalPagesChange).toHaveBeenCalled();
    });

    it("onPageChange コールバックが渡された場合も正常に保持されること", () => {
      const onPageChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 2,
            totalPages: 5,
            onPageChange,
          })}
        />,
      );

      expect(screen.getByTestId("reader-page")).toBeInTheDocument();
    });
  });

  describe("Kindle様式ジェスチャー・エピソード境界遷移検証 (AC-RD-17〜19)", () => {
    function setupContainerDimensions(element: HTMLElement, width = 300) {
      Object.defineProperty(element, "clientWidth", {
        value: width,
        configurable: true,
        writable: true,
      });
      element.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: width,
        bottom: 600,
        width,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
    }

    it("画面左端タップ（幅約 20%: x < 60px）で縦書き次ページへめくり遷移すること（AC-RD-17）", () => {
      const onPageChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 2,
            totalPages: 5,
            onPageChange,
          })}
        />,
      );

      const main = screen.getByRole("main");
      setupContainerDimensions(main, 300);

      firePointer(main, "pointerdown", { clientX: 30, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 32, clientY: 101 });

      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it("画面右端タップ（幅約 20%: x > 240px）で縦書き前ページへめくり遷移すること（AC-RD-17）", () => {
      const onPageChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 2,
            totalPages: 5,
            onPageChange,
          })}
        />,
      );

      const main = screen.getByRole("main");
      setupContainerDimensions(main, 300);

      firePointer(main, "pointerdown", { clientX: 270, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 271, clientY: 100 });

      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it("画面中央タップ（幅約 60%: 60px <= x <= 240px）で下部オーバーレイ開閉がトグルすること（AC-RD-17）", () => {
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 2,
            totalPages: 5,
            initialOverlayOpen: false,
          })}
        />,
      );

      const overlay = screen.getByTestId("reader-bottom-overlay");
      expect(overlay).toHaveAttribute("aria-hidden", "true");

      const main = screen.getByRole("main");
      setupContainerDimensions(main, 300);

      // 1回目タップで展開
      firePointer(main, "pointerdown", { clientX: 150, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 151, clientY: 100 });
      expect(overlay).toHaveAttribute("aria-hidden", "false");

      // 2回目タップで閉じる
      firePointer(main, "pointerdown", { clientX: 150, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 150, clientY: 100 });
      expect(overlay).toHaveAttribute("aria-hidden", "true");
    });

    it("水平ドラッグ移動量 30% 以上の指離しで次ページ遷移が確定すること（AC-RD-17）", () => {
      const onPageChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 2,
            totalPages: 5,
            onPageChange,
          })}
        />,
      );

      const main = screen.getByRole("main");
      setupContainerDimensions(main, 300);

      firePointer(main, "pointerdown", { clientX: 100, clientY: 100 });
      firePointer(main, "pointermove", { clientX: 200, clientY: 100 }); // dx = +100 >= 90px (30%)
      firePointer(main, "pointerup", { clientX: 200, clientY: 100 });

      expect(onPageChange).toHaveBeenCalledWith(3);
    });

    it("水平ドラッグ移動量 30% 未満の指離しでスナップバックしページ遷移しないこと（AC-RD-17）", () => {
      const onPageChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 2,
            totalPages: 5,
            onPageChange,
          })}
        />,
      );

      const main = screen.getByRole("main");
      setupContainerDimensions(main, 300);

      firePointer(main, "pointerdown", { clientX: 100, clientY: 100 });
      firePointer(main, "pointermove", { clientX: 150, clientY: 100 }); // dx = +50 < 90px
      firePointer(main, "pointerup", { clientX: 150, clientY: 100 });

      expect(onPageChange).not.toHaveBeenCalled();
    });

    it("最終ページでさらに次へドラッグ時にヒントが表示され、30%以上離上で次話遷移すること（AC-RD-18）", () => {
      const onNextChapter = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 5,
            totalPages: 5,
            chapterIndex: 1,
            totalChapters: 3,
            onNextChapter,
          })}
        />,
      );

      const main = screen.getByRole("main");
      setupContainerDimensions(main, 300);

      firePointer(main, "pointerdown", { clientX: 100, clientY: 100 });
      firePointer(main, "pointermove", { clientX: 200, clientY: 100 }); // dx = +100 >= 90px

      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("指を離して次の話へ");

      firePointer(main, "pointerup", { clientX: 200, clientY: 100 });
      expect(onNextChapter).toHaveBeenCalled();
    });

    it("第1ページでさらに前へドラッグ時にヒントが表示され、30%以上離上で前話遷移すること（AC-RD-18）", () => {
      const onPrevChapter = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 1,
            totalPages: 5,
            chapterIndex: 2,
            totalChapters: 3,
            onPrevChapter,
          })}
        />,
      );

      const main = screen.getByRole("main");
      setupContainerDimensions(main, 300);

      firePointer(main, "pointerdown", { clientX: 200, clientY: 100 });
      firePointer(main, "pointermove", { clientX: 100, clientY: 100 }); // dx = -100

      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("指を離して前の話へ");

      firePointer(main, "pointerup", { clientX: 100, clientY: 100 });
      expect(onPrevChapter).toHaveBeenCalled();
    });

    it("連続スクロールモードでの 2 段階スクロール（末尾到達後の再ホイール）で次話遷移すること（AC-RD-19）", () => {
      const onNextChapter = vi.fn();
      const onScrollProgressChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "scroll",
            chapterIndex: 1,
            totalChapters: 3,
            onNextChapter,
            onScrollProgressChange,
          })}
        />,
      );

      const main = screen.getByRole("main");
      const readerView = screen.getByTestId("reader-view");

      // 第1段階: スクロールで末尾到達
      fireEvent.scroll(readerView);

      // 第2段階: 再ホイール操作
      fireEvent.wheel(main, { deltaY: 20 });
      expect(onNextChapter).toHaveBeenCalled();
    });

    it("連続スクロールモードでの 2 段階スクロール（先頭到達後の再ホイール）で前話遷移すること（AC-RD-19）", () => {
      const onPrevChapter = vi.fn();
      const onScrollProgressChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "scroll",
            chapterIndex: 2,
            totalChapters: 3,
            onPrevChapter,
            onScrollProgressChange,
          })}
        />,
      );

      const main = screen.getByRole("main");
      const readerView = screen.getByTestId("reader-view");

      // 第1段階: スクロールで先頭到達
      fireEvent.scroll(readerView);

      // 第2段階: 再ホイール操作
      fireEvent.wheel(main, { deltaY: -20 });
      expect(onPrevChapter).toHaveBeenCalled();
    });
  });
});
