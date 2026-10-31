import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  useReaderGestures,
  type UseReaderGesturesOptions,
} from "./useReaderGestures";

function createPointerEvent(
  type: string,
  init: { clientX?: number; clientY?: number } = {},
): React.PointerEvent {
  return {
    type,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.PointerEvent;
}

function createWheelEvent(init: {
  deltaX?: number;
  deltaY?: number;
}): React.WheelEvent {
  return {
    deltaX: init.deltaX ?? 0,
    deltaY: init.deltaY ?? 0,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.WheelEvent;
}

describe("useReaderGestures", () => {
  let defaultOptions: UseReaderGesturesOptions;
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();
    mockContainer = document.createElement("div");
    Object.defineProperty(mockContainer, "clientWidth", {
      value: 300,
      configurable: true,
      writable: true,
    });
    mockContainer.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 300,
      bottom: 600,
      width: 300,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    defaultOptions = {
      writingMode: "vertical-rl",
      pagingMode: "paged",
      currentPage: 2,
      totalPages: 4,
      chapterIndex: 2,
      totalChapters: 5,
      isOverlayOpen: false,
      onToggleOverlay: vi.fn(),
      onCloseOverlay: vi.fn(),
      onPageChange: vi.fn(),
      onPrevChapter: vi.fn(),
      onNextChapter: vi.fn(),
      onScrollProgressChange: vi.fn(),
      containerRef: { current: mockContainer },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("初期状態およびプロパティ初期化", () => {
    it("初期状態で slideOffsetPx=0, isAnimating=false, boundaryHint=null であること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.boundaryHint).toBeNull();
    });

    it("initialSlideOffsetPx および initialBoundaryHint が反映されること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          initialSlideOffsetPx: 50,
          initialBoundaryHint: "指を離して次の話へ",
        }),
      );
      expect(result.current.slideOffsetPx).toBe(50);
      expect(result.current.boundaryHint).toBe("指を離して次の話へ");
    });
  });

  describe("縦書きページめくりモード（vertical-rl / paged）のジェスチャー", () => {
    it("ドラッグ中に指の水平移動にリアルタイム追従（slideOffsetPx）すること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
      });

      // 10px 未満の移動ではドラッグ判定されず offset は 0 のまま
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 105, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(0);

      // 10px 以上の移動（次ページ方向: dx = 30）で追従
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 130, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(30);

      // 前ページ方向へのドラッグ（dx = -40）
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 60, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(-40);
    });

    it("規定値（30% = 90px）以上のドラッグで次ページへの確定遷移が発生すること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
      });

      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 200, clientY: 100 }), // dx = +100 >= 90px
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 200, clientY: 100 }),
        );
      });

      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(defaultOptions.onCloseOverlay).toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("規定値（30% = 90px）以上のドラッグで前ページへの確定遷移が発生すること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
      });

      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 100 }), // dx = -100 (Math.abs >= 90px)
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 100 }),
        );
      });

      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(1);
      expect(defaultOptions.onCloseOverlay).toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("フリック速度（velocity > 0.5 px/ms）による高速フリックで移動距離30%未満でも確定遷移すること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
      });

      // 50ms 後に dx = +40px（velocity = 40 / 50 = 0.8 > 0.5）
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 140, clientY: 100 }),
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 140, clientY: 100 }),
        );
      });

      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("30% 未満かつ低速フリック時はスナップバックしてページ遷移しないこと", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
      });

      // 400ms 後に dx = +50px（velocity = 50 / 400 = 0.125 < 0.5、50px < 90px）
      vi.advanceTimersByTime(400);
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 150, clientY: 100 }),
        );
      });

      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("pointercancel 発生時にスナップバックして状態が初期化されること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(50);

      act(() => {
        result.current.handlePointerCancel();
      });

      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.boundaryHint).toBeNull();
    });
  });

  describe("エピソード境界でのラバーバンド・ヒント表示・シームレス前後話遷移", () => {
    it("最終ページ（currentPage === totalPages）で次へドラッグ時にラバーバンド減衰とヒント表示、離上で次話遷移すること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: 4,
          totalPages: 4,
          chapterIndex: 2,
          totalChapters: 5,
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
      });

      // dx = +50px: 減衰係数 0.3 が適用され slideOffsetPx = 15
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(15);
      expect(result.current.boundaryHint).toBeNull();

      // dx = +100px (>= 30% = 90px): 案内バッジ「指を離して次の話へ」が表示
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 200, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(30);
      expect(result.current.boundaryHint).toBe("指を離して次の話へ");

      // 30% 以上引き伸ばした状態で指を離す -> onNextChapter が発火
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 200, clientY: 100 }),
        );
      });
      expect(defaultOptions.onNextChapter).toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.boundaryHint).toBeNull();
    });

    it("最終ページで30%未満の離上時は次話遷移せずスナップバックすること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: 4,
          totalPages: 4,
          chapterIndex: 2,
          totalChapters: 5,
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }), // dx = +50 < 90px
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 150, clientY: 100 }),
        );
      });

      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("作品最終話（chapterIndex === totalChapters）の最終ページでは次話ヒントおよび遷移を行わないこと", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: 4,
          totalPages: 4,
          chapterIndex: 5,
          totalChapters: 5,
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 220, clientY: 100 }), // dx = 120 >= 90px
        );
      });

      expect(result.current.boundaryHint).toBeNull();

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 220, clientY: 100 }),
        );
      });

      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("第1ページ（currentPage === 1）で前へドラッグ時にラバーバンド減衰とヒント表示、離上で前話遷移すること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: 1,
          totalPages: 4,
          chapterIndex: 2,
          totalChapters: 5,
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
      });

      // dx = -100px: 減衰係数 0.3 が適用され slideOffsetPx = -30、ヒント表示
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(-30);
      expect(result.current.boundaryHint).toBe("指を離して前の話へ");

      // 離上で onPrevChapter 発火
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 100 }),
        );
      });
      expect(defaultOptions.onPrevChapter).toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.boundaryHint).toBeNull();
    });

    it("第1話（chapterIndex === 1）の第1ページでは前話ヒントおよび遷移を行わないこと", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: 1,
          totalPages: 4,
          chapterIndex: 1,
          totalChapters: 5,
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 80, clientY: 100 }), // dx = -120
        );
      });

      expect(result.current.boundaryHint).toBeNull();

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 80, clientY: 100 }),
        );
      });

      expect(defaultOptions.onPrevChapter).not.toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
    });
  });

  describe("タップ操作（誤判定防止 10px 未満 かつ 300ms 未満）", () => {
    it("画面左端タップ（幅約 20%: x < 60px）で縦書き次のページへめくること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
      });

      vi.advanceTimersByTime(100);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 32, clientY: 101 }), // distance < 10px, dt < 300ms
        );
      });

      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(defaultOptions.onToggleOverlay).not.toHaveBeenCalled();
    });

    it("画面右端タップ（幅約 20%: x > 240px）で縦書き前のページへめくること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
        );
      });

      vi.advanceTimersByTime(100);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 271, clientY: 100 }),
        );
      });

      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(1);
      expect(defaultOptions.onToggleOverlay).not.toHaveBeenCalled();
    });

    it("画面中央タップ（幅約 60%: 60px <= x <= 240px）でオーバーレイ開閉をトグルすること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 150, clientY: 100 }),
        );
      });

      vi.advanceTimersByTime(100);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 151, clientY: 100 }),
        );
      });

      expect(defaultOptions.onToggleOverlay).toHaveBeenCalled();
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();
    });

    it("オーバーレイ表示中はどの位置のタップでも onCloseOverlay が呼ばれること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          isOverlayOpen: true,
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
      });

      vi.advanceTimersByTime(100);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });

      expect(defaultOptions.onCloseOverlay).toHaveBeenCalled();
    });
  });

  describe("横書きページめくりモード（horizontal-tb / paged）のジェスチャー", () => {
    it("横書き時は右から左ドラッグ（dx < 0）が次ページ、左から右（dx > 0）が前ページとなること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 100 }), // dx = -100 (次へ)
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 100 }),
        );
      });

      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
    });

    it("横書きタップ時は右端タップが次ページ、左端タップが前ページとなること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
        }),
      );

      // 右端タップ（x = 270px > 240px）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
        );
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);

      // 左端タップ（x = 30px < 60px）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(1);
    });
  });

  describe("連続スクロールモード（scroll）時の 2 段階遷移（ホイール ＆ スワイプ操作）", () => {
    it("末尾到達（進捗 1.0）時点では次話遷移せず、到達後の再ホイール操作で次話遷移すること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
        }),
      );

      // 第1段階: スクロールで末尾到達
      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });
      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();

      // 第2段階: 末尾到達状態からのさらなる下ホイール操作
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 20 }));
      });
      expect(defaultOptions.onNextChapter).toHaveBeenCalled();
    });

    it("先頭到達（進捗 0.0）時点では前話遷移せず、到達後の再ホイール操作で前話遷移すること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
        }),
      );

      // 第1段階: スクロールで先頭到達
      act(() => {
        result.current.handleScrollProgressChange(0.0);
      });
      expect(defaultOptions.onPrevChapter).not.toHaveBeenCalled();

      // 第2段階: 先頭到達状態からの上ホイール操作
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: -20 }));
      });
      expect(defaultOptions.onPrevChapter).toHaveBeenCalled();
    });

    it("末尾到達後に途中位置へ戻った場合、ホイール操作しても次話遷移しないこと", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
        }),
      );

      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });
      // 途中に戻る
      act(() => {
        result.current.handleScrollProgressChange(0.5);
      });

      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 20 }));
      });
      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();
    });

    it("末尾到達後に新しいポインタードラッグ操作を開始した場合に次話遷移すること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          writingMode: "vertical-rl",
        }),
      );

      // 第1段階: 末尾到達
      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });

      // 第2段階: 新規ポインター操作で左方向へスワイプ（進む方向: dx < -30）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
      });

      expect(defaultOptions.onNextChapter).toHaveBeenCalled();
    });
  });
});
