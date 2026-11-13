import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./ReaderPage.stories";
import { ReaderPage, type ReaderPageProps } from "./ReaderPage";
import * as ReaderViewModule from "./ReaderView";
import * as ReaderTopOverlayModule from "./ReaderTopOverlay";
import * as ReaderBottomOverlayModule from "./ReaderBottomOverlay";
import * as BookmarkConflictDialogModule from "./BookmarkConflictDialog";
import type { NovelRecord, ChapterRecord } from "../../../storage/types";
import { ServiceProvider } from "../../../app/ServiceProvider";
import { MockVolumeKeyBridge } from "../../../bridges/volume-key/mockVolumeKeyBridge";

const {
  Default,
  OverlayOpen,
  OverlayOpenPaged,
  OverlayOpenLongTitle,
  HorizontalSepia,
  Loading,
  TransitionLoading,
  ErrorState,
  Empty,
  Paged,
  ScrollMode,
  BoundaryHintNext,
  BoundaryHintPrev,
  TapBoundaryHintNext,
  TapBoundaryHintPrev,
  ScrollBoundaryHintNext,
  ScrollBoundaryHintPrev,
  CustomFontAndMargin,
  BookmarkConflict,
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
    onBackToToc: vi.fn(),
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Default ストーリーで全画面本文と最下部タッチゾーンが描画され、オーバーレイは初期非表示（AC-RD-09）", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );

      render(<Default />);
      const page = screen.getByTestId("reader-page");
      expect(page).toBeInTheDocument();
      expect(page).toHaveClass("h-dvh");
      expect(page).toHaveClass("w-full");
      expect(page).toHaveClass("overflow-hidden");

      // 常時表示ツールバーおよび章ナビが廃止されていること
      expect(screen.queryByTestId("reader-toolbar")).not.toBeInTheDocument();

      // 本文全画面描画（子コンポーネントへ委譲）
      expect(viewSpy).toHaveBeenCalled();

      // 最下部タッチゾーン
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      expect(touchZone).toBeInTheDocument();
      expect(touchZone).toHaveAttribute("aria-expanded", "false");

      // 上部・下部オーバーレイは初期非表示（isOpen: false）
      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: false }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: false }),
        undefined,
      );
    });

    it("OverlayOpen ストーリーで上下オーバーレイが展開表示されていること", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );

      render(<OverlayOpen />);
      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
    });

    it("OverlayOpenPaged ストーリーで上下オーバーレイおよびページシークバー用ページ設定が伝播されること", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );

      render(<OverlayOpenPaged />);
      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isOpen: true,
          effectivePagingMode: "paged",
          currentPage: 2,
          totalPages: 5,
        }),
        undefined,
      );
    });

    it("OverlayOpenLongTitle ストーリーで長文タイトル・サブタイトルが ReaderTopOverlay にそのまま渡されること", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");

      render(<OverlayOpenLongTitle />);
      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isOpen: true,
          novelTitle: expect.stringContaining("とても長くて画面幅に収まらない"),
          chapterTitle:
            expect.stringContaining("第1話 見知らぬ空と見知らぬ大地"),
        }),
        undefined,
      );
    });

    it("HorizontalSepia ストーリーで横書き・セピアの ReaderView が描画されること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");

      render(<HorizontalSepia />);
      expect(viewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          writingMode: "horizontal-tb",
          theme: "sepia",
        }),
        undefined,
      );
    });

    it("Loading ストーリーでローディング表示が描画され本文や空状態が非表示となること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");

      render(<Loading />);
      expect(screen.getByTestId("reader-loading")).toBeInTheDocument();
      expect(viewSpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId("reader-empty")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-error")).not.toBeInTheDocument();
    });

    it("TransitionLoading ストーリーで話数遷移中ローディング表示が描画され本文や空状態が非表示となること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");

      render(<TransitionLoading />);
      expect(screen.getByTestId("reader-loading")).toBeInTheDocument();
      expect(screen.getByText("エピソードを読み込み中...")).toBeInTheDocument();
      expect(viewSpy).not.toHaveBeenCalled();
      expect(screen.queryByTestId("reader-empty")).not.toBeInTheDocument();
      expect(screen.queryByTestId("reader-error")).not.toBeInTheDocument();
    });

    it("ErrorState ストーリーでエラーアラートと内蔵ブラウザボタンが描画され上下オーバーレイが初期展開表示されること（AC-RD-10, AC-RD-22, AC-RD-29）", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );

      render(<ErrorState />);
      const errorEl = screen.getByTestId("reader-error");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveAttribute("role", "alert");
      expect(errorEl).toHaveTextContent("エピソード本文の取得に失敗しました");
      expect(viewSpy).not.toHaveBeenCalled();

      const openWebviewBtn = screen.getByTestId("reader-open-webview-button");
      expect(openWebviewBtn).toBeInTheDocument();
      expect(openWebviewBtn).toHaveTextContent("内蔵ブラウザで開いて取り込む");

      // エラー時は初期状態で上下オーバーレイが展開表示
      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
    });

    it("Empty ストーリーで空状態が描画され上下オーバーレイが初期展開表示されること（AC-RD-10, AC-RD-22）", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );

      render(<Empty />);
      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      expect(viewSpy).not.toHaveBeenCalled();

      // 空状態時は初期状態で上下オーバーレイが展開表示
      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
    });

    it("Paged ストーリーでページめくり組版プロパティが ReaderView と ReaderBottomOverlay に伝播されること（AC-RD-15, AC-RD-16）", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );

      render(<Paged />);
      expect(viewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pagingMode: "paged",
          currentPage: 2,
          totalPages: 5,
        }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          effectivePagingMode: "paged",
        }),
        undefined,
      );
    });

    it("ScrollMode ストーリーで連続スクロールモードとして伝播されること（AC-RD-15）", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );

      render(<ScrollMode />);
      expect(viewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pagingMode: "scroll",
        }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          effectivePagingMode: "scroll",
        }),
        undefined,
      );
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

    it("TapBoundaryHintNext ストーリーで端2段階タップの次話案内ヒントが表示されること（AC-RD-18）", () => {
      render(<TapBoundaryHintNext />);
      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("もう一度タップで次の話へ");
    });

    it("TapBoundaryHintPrev ストーリーで端2段階タップの前話案内ヒントが表示されること（AC-RD-18）", () => {
      render(<TapBoundaryHintPrev />);
      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("もう一度タップで前の話へ");
    });

    it("ScrollBoundaryHintNext ストーリーで連続スクロール端2段階スワイプの次話案内ヒントが表示されること（AC-RD-19）", () => {
      render(<ScrollBoundaryHintNext />);
      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("もう一度スワイプで次の話へ");
    });

    it("ScrollBoundaryHintPrev ストーリーで連続スクロール端2段階スワイプの前話案内ヒントが表示されること（AC-RD-19）", () => {
      render(<ScrollBoundaryHintPrev />);
      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("もう一度スワイプで前の話へ");
    });

    it("CustomFontAndMargin ストーリーで指定フォント（klee）と余白（32px）が ReaderView に反映されること (v0.5 Issue #169)", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");

      render(<CustomFontAndMargin />);
      expect(viewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fontFamily: "klee",
          pageMarginPx: 32,
        }),
        undefined,
      );
    });

    it("BookmarkConflict ストーリーで BookmarkConflictDialog に競合状態 Props が渡されること (v1.1 Issue #342)", () => {
      const conflictDialogSpy = vi.spyOn(
        BookmarkConflictDialogModule,
        "BookmarkConflictDialog",
      );
      render(<BookmarkConflict />);
      expect(conflictDialogSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isOpen: true,
          currentChapterIndex: 1,
          remoteChapterIndex: 3,
          isResolving: false,
        }),
        undefined,
      );
      conflictDialogSpy.mockRestore();
    });
  });

  describe("状態別排他描画ルールの検証", () => {
    it("error が存在する場合は isLoading が true であってもエラー表示が優先されること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      const props = createDefaultProps({
        error: "致命的なネットワークエラー",
        isLoading: true,
      });
      render(<ReaderPage {...props} />);

      expect(screen.getByTestId("reader-error")).toBeInTheDocument();
      expect(screen.queryByTestId("reader-loading")).not.toBeInTheDocument();
      expect(viewSpy).not.toHaveBeenCalled();
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
    });

    it("isLoading が true であっても既に chapter.bodyHtml が存在する場合は ReaderView が維持されること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const props = createDefaultProps({
        isLoading: true,
      });
      render(<ReaderPage {...props} />);

      expect(viewSpy).toHaveBeenCalled();
      expect(screen.queryByTestId("reader-loading")).not.toBeInTheDocument();
    });

    it("novel === null のとき空状態となり、オーバーレイが初期展開されること", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      const props = createDefaultProps({
        novel: null,
      });
      render(<ReaderPage {...props} />);

      expect(screen.getByTestId("reader-empty")).toBeInTheDocument();
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
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
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");

      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(touchZone).toHaveAttribute("aria-expanded", "false");

      // 1回目のタップ（展開）
      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      vi.spyOn(Date, "now").mockReturnValue(now + 100);
      firePointer(touchZone, "pointerup", { clientX: 102, clientY: 503 });

      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);
      expect(touchZone).toHaveAttribute("aria-expanded", "true");

      // 2回目のタップ（閉じる）
      vi.spyOn(Date, "now").mockReturnValue(now + 200);
      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      vi.spyOn(Date, "now").mockReturnValue(now + 250);
      firePointer(touchZone, "pointerup", { clientX: 100, clientY: 500 });

      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(touchZone).toHaveAttribute("aria-expanded", "false");
    });

    it("タッチ移動距離が10px以上のスワイプ・ドラッグ操作ではオーバーレイが開かないこと", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");

      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);

      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      // 上方向へ20pxスワイプ
      vi.spyOn(Date, "now").mockReturnValue(now + 80);
      firePointer(touchZone, "pointerup", { clientX: 100, clientY: 480 });

      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("タッチ時間が500ms以上の長押し操作ではオーバーレイが開かないこと", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");

      const now = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(now);
      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      // 600ms経過
      vi.spyOn(Date, "now").mockReturnValue(now + 600);
      firePointer(touchZone, "pointerup", { clientX: 100, clientY: 500 });

      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("pointercancel が発生した場合はその後の pointerup でオーバーレイが開かないこと", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");

      firePointer(touchZone, "pointerdown", { clientX: 100, clientY: 500 });
      firePointer(touchZone, "pointercancel");
      firePointer(touchZone, "pointerup", { clientX: 100, clientY: 500 });

      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("キーボード操作（Enter / Space）でオーバーレイの開閉がトグルされること", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(<ReaderPage {...createDefaultProps()} />);
      const touchZone = screen.getByTestId("reader-bottom-touch-zone");

      fireEvent.keyDown(touchZone, { key: "Enter" });
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      fireEvent.keyDown(touchZone, { key: " " });
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);

      // その他のキーでは反応しないこと
      fireEvent.keyDown(touchZone, { key: "Tab" });
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("実効 paged モード時、最下部タッチゾーンが中央60%（left-[20%] right-[20%]）に限定され左右端タップが妨げられないこと (R1-34)", () => {
      // 縦書き・auto => 実効 paged
      const { rerender } = render(
        <ReaderPage
          {...createDefaultProps({
            writingMode: "vertical-rl",
            pagingMode: "auto",
          })}
        />,
      );
      let touchZone = screen.getByTestId("reader-bottom-touch-zone");
      expect(touchZone).toHaveClass("left-[20%]");
      expect(touchZone).toHaveClass("right-[20%]");
      expect(touchZone).not.toHaveClass("left-0");
      expect(touchZone).not.toHaveClass("right-0");

      // 縦書き・paged => 実効 paged
      rerender(
        <ReaderPage
          {...createDefaultProps({
            writingMode: "vertical-rl",
            pagingMode: "paged",
          })}
        />,
      );
      touchZone = screen.getByTestId("reader-bottom-touch-zone");
      expect(touchZone).toHaveClass("left-[20%]");
      expect(touchZone).toHaveClass("right-[20%]");
    });

    it("実効 scroll モード時、最下部タッチゾーンが画面全幅（left-0 right-0）に配置されること (R1-34)", () => {
      // 横書き・auto => 実効 scroll
      const { rerender } = render(
        <ReaderPage
          {...createDefaultProps({
            writingMode: "horizontal-tb",
            pagingMode: "auto",
          })}
        />,
      );
      let touchZone = screen.getByTestId("reader-bottom-touch-zone");
      expect(touchZone).toHaveClass("left-0");
      expect(touchZone).toHaveClass("right-0");
      expect(touchZone).not.toHaveClass("left-[20%]");
      expect(touchZone).not.toHaveClass("right-[20%]");

      // 縦書き・scroll => 実効 scroll
      rerender(
        <ReaderPage
          {...createDefaultProps({
            writingMode: "vertical-rl",
            pagingMode: "scroll",
          })}
        />,
      );
      touchZone = screen.getByTestId("reader-bottom-touch-zone");
      expect(touchZone).toHaveClass("left-0");
      expect(touchZone).toHaveClass("right-0");

      // 横書き・paged => 横書きスクロール限定化により実効 scroll (v0.5 Issue #168, #173)
      rerender(
        <ReaderPage
          {...createDefaultProps({
            writingMode: "horizontal-tb",
            pagingMode: "paged",
          })}
        />,
      );
      touchZone = screen.getByTestId("reader-bottom-touch-zone");
      expect(touchZone).toHaveClass("left-0");
      expect(touchZone).toHaveClass("right-0");
    });
  });

  describe("自動非表示（Auto-Hide）トリガーの検証（AC-RD-10）", () => {
    it("オーバーレイ展開中に本文スクロールが発生した際に自動的に閉じること", async () => {
      const onScrollProgressChange = vi.fn();
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "scroll",
            initialOverlayOpen: true,
            onScrollProgressChange,
          })}
        />,
      );
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      await act(async () => {
        viewSpy.mock.calls.at(-1)?.[0]?.onScrollProgressChange?.(0.4);
      });

      expect(onScrollProgressChange).toHaveBeenCalledWith(0.4);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("オーバーレイ展開中に本文エリアをクリックした際に自動的に閉じること", async () => {
      const user = userEvent.setup();
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(
        <ReaderPage {...createDefaultProps({ initialOverlayOpen: true })} />,
      );
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      await user.click(screen.getByRole("main"));
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("オーバーレイ展開中に「前の話へ」をクリックすると onPrevChapter が呼ばれ自動的に閉じること", async () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
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
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      const lastBottomProps = bottomSpy.mock.calls.at(-1)?.[0];
      act(() => {
        lastBottomProps?.onPrevChapter?.();
      });
      expect(onPrevChapter).toHaveBeenCalledTimes(1);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("オーバーレイ展開中に「次の話へ」をクリックすると onNextChapter が呼ばれ自動的に閉じること", async () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
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
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      const lastBottomProps = bottomSpy.mock.calls.at(-1)?.[0];
      act(() => {
        lastBottomProps?.onNextChapter?.();
      });
      expect(onNextChapter).toHaveBeenCalledTimes(1);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("下部タブ（本棚 / 設定）をクリックした際に onSelectTab が呼ばれること", async () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      const onSelectTab = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            onSelectTab,
          })}
        />,
      );

      const lastBottomProps = bottomSpy.mock.calls.at(-1)?.[0];
      act(() => {
        lastBottomProps?.onSelectTab?.("bookshelf");
      });
      expect(onSelectTab).toHaveBeenCalledWith("bookshelf");

      act(() => {
        lastBottomProps?.onSelectTab?.("settings");
      });
      expect(onSelectTab).toHaveBeenCalledWith("settings");
    });

    it("activeTab が指定された場合、ReaderBottomOverlay に props が反映されること (R1-32)", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      const { rerender } = render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            activeTab: "search",
          })}
        />,
      );

      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ activeTab: "search" }),
        undefined,
      );

      rerender(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            activeTab: "ranking",
          })}
        />,
      );

      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ activeTab: "ranking" }),
        undefined,
      );
    });
  });

  describe("ページネーション状態・コールバックの伝播検証 (AC-RD-15, AC-RD-16)", () => {
    it("明示的な pagingMode, currentPage, totalPages が ReaderView に伝播されること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            currentPage: 3,
            totalPages: 10,
          })}
        />,
      );

      expect(viewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pagingMode: "paged",
          currentPage: 3,
          totalPages: 10,
        }),
        undefined,
      );
    });

    it("pagingMode, currentPage, totalPages 未指定時に既定値（auto, 1, 1）が適用されること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const props = createDefaultProps();
      delete (props as Partial<ReaderPageProps>).pagingMode;
      delete (props as Partial<ReaderPageProps>).currentPage;
      delete (props as Partial<ReaderPageProps>).totalPages;

      render(<ReaderPage {...props} />);

      expect(viewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pagingMode: "auto",
          currentPage: 1,
          totalPages: 1,
        }),
        undefined,
      );
    });

    it("ReaderView からの onTotalPagesChange イベントが親へ伝播されること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const onTotalPagesChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "paged",
            onTotalPagesChange,
          })}
        />,
      );

      act(() => {
        viewSpy.mock.calls.at(-1)?.[0]?.onTotalPagesChange?.(5);
      });
      expect(onTotalPagesChange).toHaveBeenCalledWith(5);
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
      vi.useFakeTimers();
      try {
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

        act(() => {
          vi.advanceTimersByTime(200);
        });

        expect(onPageChange).toHaveBeenCalledWith(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it("画面右端タップ（幅約 20%: x > 240px）で縦書き前ページへめくり遷移すること（AC-RD-17）", () => {
      vi.useFakeTimers();
      try {
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

        act(() => {
          vi.advanceTimersByTime(200);
        });

        expect(onPageChange).toHaveBeenCalledWith(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("縦書きページ送りタップ時に isAnimating および slideOffsetPx が ReaderView に伝達されること（AC-RD-17, R1-23）", () => {
      vi.useFakeTimers();
      try {
        const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
        render(
          <ReaderPage
            {...createDefaultProps({
              pagingMode: "paged",
              currentPage: 2,
              totalPages: 5,
            })}
          />,
        );

        const main = screen.getByRole("main");
        setupContainerDimensions(main, 300);

        expect(viewSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isAnimating: false,
            slideOffsetPx: 0,
          }),
          undefined,
        );

        // 画面左端タップ（次ページ送り開始）
        firePointer(main, "pointerdown", { clientX: 30, clientY: 100 });
        firePointer(main, "pointerup", { clientX: 32, clientY: 101 });

        // アニメーション実行中: isAnimating=true, slideOffsetPx=300 が ReaderView に伝達
        expect(viewSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isAnimating: true,
            slideOffsetPx: 300,
          }),
          undefined,
        );

        // 200ms 経過後: アニメーション完了により isAnimating=false, slideOffsetPx=0 にリセット
        act(() => {
          vi.advanceTimersByTime(200);
        });

        expect(viewSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isAnimating: false,
            slideOffsetPx: 0,
          }),
          undefined,
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("画面中央タップ（幅約 60%: 60px <= x <= 240px）で下部オーバーレイ開閉がトグルすること（AC-RD-17）", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
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

      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);

      const main = screen.getByRole("main");
      setupContainerDimensions(main, 300);

      // 1回目タップで展開
      firePointer(main, "pointerdown", { clientX: 150, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 151, clientY: 100 });
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      // 2回目タップで閉じる
      firePointer(main, "pointerdown", { clientX: 150, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 150, clientY: 100 });
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("連続スクロールモード（pagingMode: 'scroll'）でも画面中央タップで下部オーバーレイ開閉がトグルすること (R2-02)", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "scroll",
            initialOverlayOpen: false,
          })}
        />,
      );

      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);

      const main = screen.getByRole("main");
      setupContainerDimensions(main, 300);

      // 1回目タップで展開
      firePointer(main, "pointerdown", { clientX: 150, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 151, clientY: 100 });
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      // 2回目タップで閉じる
      firePointer(main, "pointerdown", { clientX: 150, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 150, clientY: 100 });
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("水平ドラッグ移動量 30% 以上の指離しで次ページ遷移が確定すること（AC-RD-17）", () => {
      vi.useFakeTimers();
      try {
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

        firePointer(main, "pointerdown", { clientX: 200, clientY: 100 });
        firePointer(main, "pointermove", { clientX: 300, clientY: 100 }); // dx = +100 >= 90px (30%)
        firePointer(main, "pointerup", { clientX: 300, clientY: 100 });

        act(() => {
          vi.advanceTimersByTime(200);
        });

        expect(onPageChange).toHaveBeenCalledWith(3);
      } finally {
        vi.useRealTimers();
      }
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

      firePointer(main, "pointerdown", { clientX: 200, clientY: 100 });
      firePointer(main, "pointermove", { clientX: 250, clientY: 100 }); // dx = +50 (Math.abs < 90px)
      firePointer(main, "pointerup", { clientX: 250, clientY: 100 });

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

      firePointer(main, "pointerdown", { clientX: 200, clientY: 100 });
      firePointer(main, "pointermove", { clientX: 300, clientY: 100 }); // dx = +100 (Math.abs >= 90px)

      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("指を離して次の話へ");

      firePointer(main, "pointerup", { clientX: 300, clientY: 100 });
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
      firePointer(main, "pointermove", { clientX: 100, clientY: 100 }); // dx = -100 (Math.abs >= 90px)

      const hint = screen.getByTestId("reader-episode-boundary-hint");
      expect(hint).toBeInTheDocument();
      expect(hint).toHaveTextContent("指を離して前の話へ");

      firePointer(main, "pointerup", { clientX: 100, clientY: 100 });
      expect(onPrevChapter).toHaveBeenCalled();
    });

    it("連続スクロールモードでの 2 段階スクロール（末尾到達後の再ホイール）で次話遷移すること（AC-RD-19）", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
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

      // 第1段階: スクロール進捗 1.0 で末尾到達を通知
      act(() => {
        viewSpy.mock.calls.at(-1)?.[0]?.onScrollProgressChange?.(1.0);
      });

      // 第2段階: 1回目の再ホイール操作で案内ヒント表示、2.5秒以内の2回目で次話遷移
      vi.useFakeTimers();
      try {
        fireEvent.wheel(main, { deltaY: 20 });
        expect(onNextChapter).not.toHaveBeenCalled();
        expect(
          screen.getByTestId("reader-episode-boundary-hint"),
        ).toHaveTextContent("もう一度スワイプで次の話へ");

        act(() => {
          vi.advanceTimersByTime(500);
        });
        fireEvent.wheel(main, { deltaY: 20 });
        expect(onNextChapter).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("連続スクロールモードでの 2 段階スクロール（先頭到達後の再ホイール）で前話遷移すること（AC-RD-19）", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
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

      // 第1段階: スクロール進捗 0 で先頭到達を通知
      act(() => {
        viewSpy.mock.calls.at(-1)?.[0]?.onScrollProgressChange?.(0);
      });

      // 第2段階: 1回目のホイールでヒント、2回目で前話遷移
      vi.useFakeTimers();
      try {
        fireEvent.wheel(main, { deltaY: -20 });
        expect(onPrevChapter).not.toHaveBeenCalled();
        expect(
          screen.getByTestId("reader-episode-boundary-hint"),
        ).toHaveTextContent("もう一度スワイプで前の話へ");

        act(() => {
          vi.advanceTimersByTime(500);
        });
        fireEvent.wheel(main, { deltaY: -20 });
        expect(onPrevChapter).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("実機タッチ制御（touch-action: none / touch-none）の検証（AC-RD-18）", () => {
    it("縦書き paged モード時、main 要素に touch-none クラスが付与されること", () => {
      render(
        <ReaderPage
          {...createDefaultProps({
            writingMode: "vertical-rl",
            pagingMode: "paged",
          })}
        />,
      );
      const main = screen.getByRole("main");
      expect(main).toHaveClass("touch-none");
    });

    it("連続スクロールモード時、main 要素に touch-none クラスが付与されないこと", () => {
      render(
        <ReaderPage
          {...createDefaultProps({
            writingMode: "vertical-rl",
            pagingMode: "scroll",
          })}
        />,
      );
      const main = screen.getByRole("main");
      expect(main).not.toHaveClass("touch-none");
    });
  });

  describe("連続スクロール時の本文先頭・末尾前後話ボタン（AC-RD-19）", () => {
    it("スクロールモード時、ReaderView へ chapterIndex/totalChapters と onPrevChapter/onNextChapter が委譲されること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const onPrevChapter = vi.fn();
      const onNextChapter = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            pagingMode: "scroll",
            chapterIndex: 2,
            totalChapters: 4,
            onPrevChapter,
            onNextChapter,
          })}
        />,
      );

      expect(viewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pagingMode: "scroll",
          chapterIndex: 2,
          totalChapters: 4,
        }),
        undefined,
      );

      const lastViewProps = viewSpy.mock.calls.at(-1)?.[0];
      act(() => {
        lastViewProps?.onPrevChapter?.();
      });
      expect(onPrevChapter).toHaveBeenCalledTimes(1);

      act(() => {
        lastViewProps?.onNextChapter?.();
      });
      expect(onNextChapter).toHaveBeenCalledTimes(1);
    });
  });

  describe("フォント種別・画面余白 props の ReaderView への伝播検証 (AC-RD-21, SYS-REQ-09, v0.5 Issue #169, #180)", () => {
    it("fontFamily と pageMarginPx が指定された場合、直接描画される ReaderView に伝播されること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      render(
        <ReaderPage
          {...createDefaultProps({
            fontFamily: "klee",
            pageMarginPx: 36,
          })}
        />,
      );

      expect(viewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fontFamily: "klee",
          pageMarginPx: 36,
        }),
        undefined,
      );
    });

    it("fontFamily と pageMarginPx が省略された場合、undefined のまま ReaderView に委譲されること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      render(<ReaderPage {...createDefaultProps()} />);

      expect(viewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fontFamily: undefined,
          pageMarginPx: undefined,
        }),
        undefined,
      );
    });
  });

  describe("上下連動オーバーレイおよびシークバー・目次復帰の統合検証 (AC-RD-22〜25, TR-06, v0.6 Issue #202)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("ReaderTopOverlay と ReaderBottomOverlay に開閉状態 isOpen が上下連動して渡されること (AC-RD-22, R1-23)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      const { rerender } = render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: false,
          })}
        />,
      );

      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: false }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: false }),
        undefined,
      );

      rerender(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
          })}
        />,
      );

      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
    });

    it("作品タイトルとエピソードサブタイトルが ReaderTopOverlay に正しく伝播されること (AC-RD-23, R1-23)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            novel: {
              ...sampleNovel,
              title: "テスト作品タイトル",
            },
            chapter: {
              ...sampleChapter,
              title: "テストエピソード第1話",
            },
          })}
        />,
      );

      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          novelTitle: "テスト作品タイトル",
          chapterTitle: "テストエピソード第1話",
        }),
        undefined,
      );
    });

    it("novel または chapter が null の場合でも ReaderTopOverlay に空文字が渡されること (R1-23)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            novel: null,
            chapter: null,
          })}
        />,
      );

      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          novelTitle: "",
          chapterTitle: "",
        }),
        undefined,
      );
    });

    it("ReaderTopOverlay に渡された onBackToToc 呼び出し時にコールバックが発火すること (AC-RD-24, TR-06, R1-23)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const onBackToToc = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            onBackToToc,
          })}
        />,
      );

      const lastTopProps = topSpy.mock.calls.at(-1)?.[0];
      act(() => {
        lastTopProps?.onBackToToc();
      });
      expect(onBackToToc).toHaveBeenCalledTimes(1);
    });

    it("onBackToToc 省略時でも ReaderTopOverlay の onBackToToc 呼び出しでクラッシュしないこと (R1-23)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            onBackToToc: undefined,
          })}
        />,
      );

      const lastTopProps = topSpy.mock.calls.at(-1)?.[0];
      expect(() => {
        act(() => {
          lastTopProps?.onBackToToc();
        });
      }).not.toThrow();
    });

    it("縦書き paged モード時、ReaderBottomOverlay に effectivePagingMode='paged' とシークバー用 Props が伝播されること (AC-RD-25, R1-23)", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            writingMode: "vertical-rl",
            pagingMode: "paged",
            currentPage: 3,
            totalPages: 10,
          })}
        />,
      );

      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          effectivePagingMode: "paged",
          currentPage: 3,
          totalPages: 10,
        }),
        undefined,
      );
    });

    it("連続スクロールモード時、ReaderBottomOverlay に effectivePagingMode='scroll' が伝播されること (AC-RD-25, R1-23)", () => {
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            writingMode: "vertical-rl",
            pagingMode: "scroll",
            currentPage: 3,
            totalPages: 10,
          })}
        />,
      );

      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          effectivePagingMode: "scroll",
          currentPage: 3,
          totalPages: 10,
        }),
        undefined,
      );
    });

    it("ReaderBottomOverlay の onPageChange 呼び出し時、onPageChange が発火し、かつオーバーレイが開いたまま維持されること (AC-RD-25, §3.6, R1-23)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      const onPageChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            writingMode: "vertical-rl",
            pagingMode: "paged",
            currentPage: 2,
            totalPages: 5,
            onPageChange,
          })}
        />,
      );

      const lastBottomProps = bottomSpy.mock.calls.at(-1)?.[0];
      act(() => {
        lastBottomProps?.onPageChange?.(4);
      });

      expect(onPageChange).toHaveBeenCalledTimes(1);
      expect(onPageChange).toHaveBeenCalledWith(4);

      // 操作後も上下オーバーレイが開いたまま維持されること
      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
      expect(bottomSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
    });

    it("onPageChange 省略時に ReaderBottomOverlay の onPageChange を呼び出してもクラッシュせずオーバーレイが開いたまま維持されること (R1-23)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            writingMode: "vertical-rl",
            pagingMode: "paged",
            currentPage: 2,
            totalPages: 5,
            onPageChange: undefined,
          })}
        />,
      );

      const lastBottomProps = bottomSpy.mock.calls.at(-1)?.[0];
      expect(() => {
        act(() => {
          lastBottomProps?.onPageChange?.(4);
        });
      }).not.toThrow();

      expect(topSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ isOpen: true }),
        undefined,
      );
    });

    it("画面中央タップで上下オーバーレイが同時に開閉トグルすること (AC-RD-22)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: false,
          })}
        />,
      );

      const main = screen.getByRole("main");

      // 初期状態: 閉
      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);

      // 中央タップ: 開
      Object.defineProperty(main, "clientWidth", {
        value: 300,
        configurable: true,
        writable: true,
      });
      firePointer(main, "pointerdown", { clientX: 150, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 150, clientY: 100 });

      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      // 再タップ: 閉
      firePointer(main, "pointerdown", { clientX: 150, clientY: 100 });
      firePointer(main, "pointerup", { clientX: 150, clientY: 100 });
      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("最下部タッチゾーン操作で上下オーバーレイが同時に開閉トグルすること (AC-RD-22)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: false,
          })}
        />,
      );

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");

      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);

      // キーボード（Enter）で展開
      fireEvent.keyDown(touchZone, { key: "Enter" });
      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      // キーボード（Space）で閉じる
      fireEvent.keyDown(touchZone, { key: " " });
      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("前話・次話遷移時およびスクロール時に上下オーバーレイが自動で閉じること", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      const onPrevChapter = vi.fn();
      const onNextChapter = vi.fn();
      const onScrollProgressChange = vi.fn();

      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            chapterIndex: 2,
            totalChapters: 3,
            onPrevChapter,
            onNextChapter,
            onScrollProgressChange,
          })}
        />,
      );

      const touchZone = screen.getByTestId("reader-bottom-touch-zone");
      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      // 前話ボタン押下（ReaderBottomOverlay の onPrevChapter 呼び出し）でオーバーレイが閉じる
      act(() => {
        bottomSpy.mock.calls.at(-1)?.[0]?.onPrevChapter?.();
      });
      expect(onPrevChapter).toHaveBeenCalledTimes(1);
      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);

      // タッチゾーン操作で再度開く
      fireEvent.keyDown(touchZone, { key: "Enter" });
      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      // 次話ボタン押下（ReaderBottomOverlay の onNextChapter 呼び出し）でオーバーレイが閉じる
      act(() => {
        bottomSpy.mock.calls.at(-1)?.[0]?.onNextChapter?.();
      });
      expect(onNextChapter).toHaveBeenCalledTimes(1);
      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("連続スクロールモードでの本文スクロール時に上下オーバーレイが自動で閉じること", () => {
      const viewSpy = vi.spyOn(ReaderViewModule, "ReaderView");
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const bottomSpy = vi.spyOn(
        ReaderBottomOverlayModule,
        "ReaderBottomOverlay",
      );
      const onScrollProgressChange = vi.fn();
      render(
        <ReaderPage
          {...createDefaultProps({
            initialOverlayOpen: true,
            pagingMode: "scroll",
            writingMode: "horizontal-tb",
            onScrollProgressChange,
          })}
        />,
      );

      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      act(() => {
        viewSpy.mock.calls.at(-1)?.[0]?.onScrollProgressChange?.(0.5);
      });

      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(bottomSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
      expect(onScrollProgressChange).toHaveBeenCalledWith(0.5);
    });
  });

  describe("ハードウェア音量キー操作連携（enableVolumeKeyPaging / AC-RD-26, AC-RD-27）", () => {
    it("enableVolumeKeyPaging=true のとき addVolumeKeyListener が先に登録された後に setVolumeKeyPagingEnabled(true) が呼び出されること (R1-04)", () => {
      const mockBridge = new MockVolumeKeyBridge();
      const setEnabledSpy = vi.spyOn(mockBridge, "setVolumeKeyPagingEnabled");
      const addListenerSpy = vi.spyOn(mockBridge, "addVolumeKeyListener");

      const { unmount } = render(
        <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
          <ReaderPage
            {...createDefaultProps({
              enableVolumeKeyPaging: true,
            })}
          />
        </ServiceProvider>,
      );

      expect(addListenerSpy).toHaveBeenCalled();
      expect(setEnabledSpy).toHaveBeenCalledWith(true);
      expect(addListenerSpy.mock.invocationCallOrder[0]).toBeLessThan(
        setEnabledSpy.mock.invocationCallOrder[0],
      );

      unmount();
      expect(setEnabledSpy).toHaveBeenCalledWith(false);
    });

    it("setVolumeKeyPagingEnabled(true) または setVolumeKeyPagingEnabled(false) が reject しても未処理の Promise Rejection が発生しないこと (R1-08)", async () => {
      const mockBridge = new MockVolumeKeyBridge();
      vi.spyOn(mockBridge, "setVolumeKeyPagingEnabled").mockRejectedValue(
        new Error("Native plugin error"),
      );

      const { unmount } = render(
        <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
          <ReaderPage
            {...createDefaultProps({
              enableVolumeKeyPaging: true,
            })}
          />
        </ServiceProvider>,
      );

      unmount();
      await act(async () => {
        await Promise.resolve();
      });
    });

    it("enableVolumeKeyPaging=false のとき volumeKeyBridge.setVolumeKeyPagingEnabled(true) は呼び出されないこと", () => {
      const mockBridge = new MockVolumeKeyBridge();
      const setEnabledSpy = vi.spyOn(mockBridge, "setVolumeKeyPagingEnabled");
      const addListenerSpy = vi.spyOn(mockBridge, "addVolumeKeyListener");

      render(
        <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
          <ReaderPage
            {...createDefaultProps({
              enableVolumeKeyPaging: false,
            })}
          />
        </ServiceProvider>,
      );

      expect(setEnabledSpy).not.toHaveBeenCalled();
      expect(addListenerSpy).not.toHaveBeenCalled();
    });

    it("音量［ー］押下イベントで次ページスライドアニメーションが開始され200ms後に確定すること (AC-RD-26)", () => {
      vi.useFakeTimers();
      try {
        const mockBridge = new MockVolumeKeyBridge();
        const onPageChange = vi.fn();

        render(
          <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
            <ReaderPage
              {...createDefaultProps({
                enableVolumeKeyPaging: true,
                currentPage: 1,
                totalPages: 3,
                onPageChange,
              })}
            />
          </ServiceProvider>,
        );

        act(() => {
          mockBridge.triggerVolumeKey("down");
        });

        act(() => {
          vi.advanceTimersByTime(200);
        });

        expect(onPageChange).toHaveBeenCalledWith(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("音量［＋］押下イベントで前ページスライドアニメーションが開始され200ms後に確定すること (AC-RD-26)", () => {
      vi.useFakeTimers();
      try {
        const mockBridge = new MockVolumeKeyBridge();
        const onPageChange = vi.fn();

        render(
          <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
            <ReaderPage
              {...createDefaultProps({
                enableVolumeKeyPaging: true,
                currentPage: 2,
                totalPages: 3,
                onPageChange,
              })}
            />
          </ServiceProvider>,
        );

        act(() => {
          mockBridge.triggerVolumeKey("up");
        });

        act(() => {
          vi.advanceTimersByTime(200);
        });

        expect(onPageChange).toHaveBeenCalledWith(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("最終ページ到達時に音量［ー］の1回目で案内ヒントが表示され、2.5秒以内の2回目で onNextChapter が呼び出されること (AC-RD-27)", () => {
      vi.useFakeTimers();
      try {
        const mockBridge = new MockVolumeKeyBridge();
        const onNextChapter = vi.fn();

        render(
          <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
            <ReaderPage
              {...createDefaultProps({
                enableVolumeKeyPaging: true,
                currentPage: 3,
                totalPages: 3,
                chapterIndex: 1,
                totalChapters: 3,
                onNextChapter,
              })}
            />
          </ServiceProvider>,
        );

        act(() => {
          mockBridge.triggerVolumeKey("down");
        });

        expect(
          screen.getByTestId("reader-episode-boundary-hint"),
        ).toHaveTextContent("もう一度操作で次の話へ");
        expect(onNextChapter).not.toHaveBeenCalled();

        act(() => {
          vi.advanceTimersByTime(1000);
        });

        act(() => {
          mockBridge.triggerVolumeKey("down");
        });

        expect(onNextChapter).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("オーバーレイ展開中に音量キーイベントが発火した際、オーバーレイが自動で非表示になること (AC-RD-27)", () => {
      const topSpy = vi.spyOn(ReaderTopOverlayModule, "ReaderTopOverlay");
      const mockBridge = new MockVolumeKeyBridge();

      render(
        <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
          <ReaderPage
            {...createDefaultProps({
              enableVolumeKeyPaging: true,
              initialOverlayOpen: true,
              currentPage: 1,
              totalPages: 3,
            })}
          />
        </ServiceProvider>,
      );

      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(true);

      act(() => {
        mockBridge.triggerVolumeKey("down");
      });

      expect(topSpy.mock.calls.at(-1)?.[0]?.isOpen).toBe(false);
    });

    it("enableVolumeKeyPaging が true から false に切り替わった場合、リスナーが解除され setVolumeKeyPagingEnabled(false) が呼ばれること", () => {
      const mockBridge = new MockVolumeKeyBridge();
      const setEnabledSpy = vi.spyOn(mockBridge, "setVolumeKeyPagingEnabled");

      const { rerender } = render(
        <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
          <ReaderPage
            {...createDefaultProps({
              enableVolumeKeyPaging: true,
            })}
          />
        </ServiceProvider>,
      );

      expect(setEnabledSpy).toHaveBeenCalledWith(true);

      rerender(
        <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
          <ReaderPage
            {...createDefaultProps({
              enableVolumeKeyPaging: false,
            })}
          />
        </ServiceProvider>,
      );

      expect(setEnabledSpy).toHaveBeenCalledWith(false);
    });

    it("エラー画面で「内蔵ブラウザで開いて取り込む」ボタン押下時に onOpenWebView が呼び出されること (AC-RD-29, TR-10)", async () => {
      const user = userEvent.setup();
      const onOpenWebView = vi.fn();

      render(
        <ReaderPage
          {...createDefaultProps({
            error: "エピソード本文の取得に失敗しました",
            onOpenWebView,
          })}
        />,
      );

      const openButton = screen.getByTestId("reader-open-webview-button");
      expect(openButton).toBeInTheDocument();
      await user.click(openButton);

      expect(onOpenWebView).toHaveBeenCalledTimes(1);
    });

    it("onOpenWebView が省略された場合でもボタン押下でエラーにならないこと", async () => {
      const user = userEvent.setup();

      render(
        <ReaderPage
          {...createDefaultProps({
            error: "エピソード本文の取得に失敗しました",
          })}
        />,
      );

      const openButton = screen.getByTestId("reader-open-webview-button");
      await expect(user.click(openButton)).resolves.not.toThrow();
    });
  });

  describe("しおり競合確認ダイアログ連携 (Issue #342)", () => {
    it("bookmarkConflict が設定されているとき BookmarkConflictDialog へ Props と選択コールバックが伝播し、null 時は isOpen: false が渡されること", () => {
      const conflictDialogSpy = vi.spyOn(
        BookmarkConflictDialogModule,
        "BookmarkConflictDialog",
      );
      const onResolveMove = vi.fn();
      const onResolveKeep = vi.fn();

      const { rerender } = render(
        <ReaderPage
          {...createDefaultProps({
            bookmarkConflict: null,
            isResolvingBookmarkConflict: false,
          })}
        />,
      );

      expect(conflictDialogSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isOpen: false,
          currentChapterIndex: 1,
          remoteChapterIndex: 1,
          isResolving: false,
        }),
        undefined,
      );

      rerender(
        <ReaderPage
          {...createDefaultProps({
            bookmarkConflict: {
              currentChapterIndex: 1,
              remoteChapterIndex: 3,
            },
            isResolvingBookmarkConflict: true,
            onResolveBookmarkConflictMove: onResolveMove,
            onResolveBookmarkConflictKeep: onResolveKeep,
          })}
        />,
      );

      expect(conflictDialogSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isOpen: true,
          currentChapterIndex: 1,
          remoteChapterIndex: 3,
          isResolving: true,
          onMoveToRemote: onResolveMove,
          onKeepCurrent: onResolveKeep,
        }),
        undefined,
      );

      const lastDialogProps = conflictDialogSpy.mock.calls.at(-1)?.[0];
      act(() => {
        lastDialogProps?.onMoveToRemote?.();
        lastDialogProps?.onKeepCurrent?.();
      });
      expect(onResolveMove).toHaveBeenCalledTimes(1);
      expect(onResolveKeep).toHaveBeenCalledTimes(1);
      conflictDialogSpy.mockRestore();
    });

    it("bookmarkConflict 表示中はハードウェア音量キーによるページめくりが抑止されること", () => {
      const onPageChange = vi.fn();
      const mockBridge = new MockVolumeKeyBridge();

      render(
        <ServiceProvider services={{ volumeKeyBridge: mockBridge }}>
          <ReaderPage
            {...createDefaultProps({
              enableVolumeKeyPaging: true,
              pagingMode: "paged",
              currentPage: 1,
              totalPages: 5,
              onPageChange,
              bookmarkConflict: {
                currentChapterIndex: 1,
                remoteChapterIndex: 3,
              },
            })}
          />
        </ServiceProvider>,
      );

      act(() => {
        mockBridge.triggerVolumeKey("down");
      });

      expect(onPageChange).not.toHaveBeenCalled();
    });
  });
});
