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

function createTouchEvent(
  type: string,
  touches: Array<{ clientX: number; clientY: number }>,
): React.TouchEvent {
  return {
    type,
    touches: touches.map((t) => ({ clientX: t.clientX, clientY: t.clientY })),
    changedTouches: touches.map((t) => ({
      clientX: t.clientX,
      clientY: t.clientY,
    })),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.TouchEvent;
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
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
      });

      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 300, clientY: 100 }), // dx = +100 (Math.abs >= 90px)
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 300, clientY: 100 }),
        );
      });

      // 離上直後は +pageWidth へ滑り切りアニメーション中、onPageChange は未呼び出し
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 200ms 後に onPageChange が確定し、リセットされること
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(defaultOptions.onCloseOverlay).toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.isAnimating).toBe(false);
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

      // 離上直後は -pageWidth へ滑り切りアニメーション中、onPageChange は未呼び出し
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(-300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 200ms 後に onPageChange が確定し、リセットされること
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(1);
      expect(defaultOptions.onCloseOverlay).toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.isAnimating).toBe(false);
    });

    it("フリック速度（velocity > 0.5 px/ms）による高速フリックで移動距離30%未満でも確定遷移すること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
      });

      // 50ms 後に dx = +40px（velocity = 40 / 50 = 0.8 > 0.5）
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 240, clientY: 100 }),
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 240, clientY: 100 }),
        );
      });

      // 離上直後は +pageWidth へ滑り切りアニメーション中、onPageChange は未呼び出し
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 200ms 後に onPageChange が確定し、リセットされること
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.isAnimating).toBe(false);
    });

    it("30% 未満かつ低速フリック時はスナップバックしてページ遷移しないこと", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
      });

      // 400ms 後に dx = -50px（velocity = 50 / 400 = 0.125 < 0.5、50px < 90px）
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
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
      });

      // dx = +50px: 減衰係数 0.3 が適用され slideOffsetPx = 15
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 250, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(15);
      expect(result.current.boundaryHint).toBeNull();

      // dx = +100px (Math.abs >= 30% = 90px): 案内バッジ「指を離して次の話へ」が表示
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 300, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(30);
      expect(result.current.boundaryHint).toBe("指を離して次の話へ");

      // 30% 以上引き伸ばした状態で指を離す -> onNextChapter が発火
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 300, clientY: 100 }),
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
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 250, clientY: 100 }), // dx = +50 < 90px
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 250, clientY: 100 }),
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
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 320, clientY: 100 }), // dx = +120 >= 90px
        );
      });

      expect(result.current.boundaryHint).toBeNull();

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 320, clientY: 100 }),
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

      // タップ直後は +pageWidth へスライドアニメーション中、onPageChange は未呼び出し
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();
      expect(defaultOptions.onToggleOverlay).not.toHaveBeenCalled();

      // 200ms 後に onPageChange が呼ばれ、リセットされること
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.isAnimating).toBe(false);
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

      // タップ直後は -pageWidth へスライドアニメーション中、onPageChange は未呼び出し
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(-300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();
      expect(defaultOptions.onToggleOverlay).not.toHaveBeenCalled();

      // 200ms 後に onPageChange が呼ばれ、リセットされること
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(1);
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.isAnimating).toBe(false);
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

    it("100ms以内の連続タップ時に既存の tapTimer がクリアされ、アニメーション中の2回目タップで1回目が即時確定すること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      // 1回目のタップ
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
      });
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });

      // 1回目タップ直後: slideOffsetPx=300, isAnimating=true, onPageChange はまだ呼ばれていない
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 30ms後（100ms以内）に2回目のタップ開始（pointerdown）
      // アニメーション中のため1回目の保留遷移（page: 3）が即時確定される！
      vi.advanceTimersByTime(30);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(defaultOptions.onPageChange).toHaveBeenCalledTimes(1);

      // 2回目のタップ離上（pointerup）
      vi.advanceTimersByTime(20);
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      // 2回目のタップ直後: 確定済みページ3から次ページ4へのアニメーション開始
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);

      // 200ms 後に 2回目の onPageChange(4) が確定
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(4);
      expect(defaultOptions.onPageChange).toHaveBeenCalledTimes(2);
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.isAnimating).toBe(false);
    });

    describe("端ページでの2段階タップによる前後話移動と案内ヒント表示 (AC-RD-18, v0.5 Issue #168, #175)", () => {
      it("縦書きpagedの最終ページで左端タップ時、1回目でヒント表示、2.5秒以内の2回目で次話遷移すること", () => {
        const onNextChapter = vi.fn();
        const { result } = renderHook(() =>
          useReaderGestures({
            ...defaultOptions,
            currentPage: 4,
            totalPages: 4,
            chapterIndex: 1,
            totalChapters: 3,
            onNextChapter,
          }),
        );

        // 1回目のタップ（左端 x=30 < 60px）
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

        // 1回目では遷移せず、案内ヒントが表示されること
        expect(onNextChapter).not.toHaveBeenCalled();
        expect(result.current.boundaryHint).toBe("もう一度タップで次の話へ");

        // 1秒後（2.5秒以内）に2回目のタップ
        vi.advanceTimersByTime(1000);
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

        // 2回目タップで次話へ遷移し、ヒントが消去されること
        expect(onNextChapter).toHaveBeenCalledTimes(1);
        expect(result.current.boundaryHint).toBeNull();
      });

      it("最終ページでの1回目タップ後、2.5秒無操作で案内ヒントが自動消去され状態がリセットされること", () => {
        const onNextChapter = vi.fn();
        const { result } = renderHook(() =>
          useReaderGestures({
            ...defaultOptions,
            currentPage: 4,
            totalPages: 4,
            chapterIndex: 1,
            totalChapters: 3,
            onNextChapter,
          }),
        );

        // 1回目のタップ
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
        expect(result.current.boundaryHint).toBe("もう一度タップで次の話へ");

        // 2.5秒経過
        act(() => {
          vi.advanceTimersByTime(2500);
        });
        expect(result.current.boundaryHint).toBeNull();

        // 2.5秒経過後のタップは再度1回目扱いとなり、遷移しないこと
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
        expect(onNextChapter).not.toHaveBeenCalled();
        expect(result.current.boundaryHint).toBe("もう一度タップで次の話へ");
      });

      it("縦書きpagedの第1ページで右端タップ時、1回目でヒント表示、2.5秒以内の2回目で前話遷移すること", () => {
        const onPrevChapter = vi.fn();
        const { result } = renderHook(() =>
          useReaderGestures({
            ...defaultOptions,
            currentPage: 1,
            totalPages: 4,
            chapterIndex: 2,
            totalChapters: 3,
            onPrevChapter,
          }),
        );

        // 1回目のタップ（右端 x=270 > 240px）
        act(() => {
          result.current.handlePointerDown(
            createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
          );
        });
        vi.advanceTimersByTime(100);
        act(() => {
          result.current.handlePointerUp(
            createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
          );
        });

        expect(onPrevChapter).not.toHaveBeenCalled();
        expect(result.current.boundaryHint).toBe("もう一度タップで前の話へ");

        // 2回目タップ
        vi.advanceTimersByTime(500);
        act(() => {
          result.current.handlePointerDown(
            createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
          );
        });
        vi.advanceTimersByTime(100);
        act(() => {
          result.current.handlePointerUp(
            createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
          );
        });

        expect(onPrevChapter).toHaveBeenCalledTimes(1);
        expect(result.current.boundaryHint).toBeNull();
      });

      it("第1ページでの1回目タップ後、2.5秒無操作で案内ヒントが自動消去され状態がリセットされること", () => {
        const onPrevChapter = vi.fn();
        const { result } = renderHook(() =>
          useReaderGestures({
            ...defaultOptions,
            currentPage: 1,
            totalPages: 4,
            chapterIndex: 2,
            totalChapters: 3,
            onPrevChapter,
          }),
        );

        // 1回目のタップ
        act(() => {
          result.current.handlePointerDown(
            createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
          );
        });
        vi.advanceTimersByTime(100);
        act(() => {
          result.current.handlePointerUp(
            createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
          );
        });
        expect(result.current.boundaryHint).toBe("もう一度タップで前の話へ");

        // 2.5秒経過
        act(() => {
          vi.advanceTimersByTime(2500);
        });
        expect(result.current.boundaryHint).toBeNull();

        // 2.5秒経過後のタップは再度1回目扱いとなり、遷移しないこと
        act(() => {
          result.current.handlePointerDown(
            createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
          );
        });
        vi.advanceTimersByTime(100);
        act(() => {
          result.current.handlePointerUp(
            createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
          );
        });
        expect(onPrevChapter).not.toHaveBeenCalled();
        expect(result.current.boundaryHint).toBe("もう一度タップで前の話へ");
      });

      it("作品の最終話（chapterIndex=totalChapters）の最終ページでは次話タップヒントを表示しないこと", () => {
        const onNextChapter = vi.fn();
        const { result } = renderHook(() =>
          useReaderGestures({
            ...defaultOptions,
            currentPage: 4,
            totalPages: 4,
            chapterIndex: 3,
            totalChapters: 3,
            onNextChapter,
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

        expect(onNextChapter).not.toHaveBeenCalled();
        expect(result.current.boundaryHint).toBeNull();
      });

      it("作品の第1話（chapterIndex=1）の第1ページでは前話タップヒントを表示しないこと", () => {
        const onPrevChapter = vi.fn();
        const { result } = renderHook(() =>
          useReaderGestures({
            ...defaultOptions,
            currentPage: 1,
            totalPages: 4,
            chapterIndex: 1,
            totalChapters: 3,
            onPrevChapter,
          }),
        );

        act(() => {
          result.current.handlePointerDown(
            createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
          );
        });
        vi.advanceTimersByTime(100);
        act(() => {
          result.current.handlePointerUp(
            createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
          );
        });

        expect(onPrevChapter).not.toHaveBeenCalled();
        expect(result.current.boundaryHint).toBeNull();
      });

      it("1回目端タップ後に中央をタップした場合、案内ヒントが消去されオーバーレイがトグルされること", () => {
        const onToggleOverlay = vi.fn();
        const { result } = renderHook(() =>
          useReaderGestures({
            ...defaultOptions,
            currentPage: 4,
            totalPages: 4,
            chapterIndex: 1,
            totalChapters: 3,
            onToggleOverlay,
          }),
        );

        // 1回目の左端タップ
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
        expect(result.current.boundaryHint).toBe("もう一度タップで次の話へ");

        // 中央タップ
        act(() => {
          result.current.handlePointerDown(
            createPointerEvent("pointerdown", { clientX: 150, clientY: 100 }),
          );
        });
        vi.advanceTimersByTime(100);
        act(() => {
          result.current.handlePointerUp(
            createPointerEvent("pointerup", { clientX: 150, clientY: 100 }),
          );
        });
        expect(onToggleOverlay).toHaveBeenCalled();
        expect(result.current.boundaryHint).toBeNull();
      });
    });
  });

  describe("横書き時のスクロール限定化とジェスチャー無効化 (v0.5 Issue #168, #173)", () => {
    it("横書き時はドラッグ操作によるページめくりが発火しないこと（実効 scroll 固定）", () => {
      const onPageChange = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
          pagingMode: "paged",
          onPageChange,
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 100 }), // dx = -100
        );
      });

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 100 }),
        );
      });

      expect(onPageChange).not.toHaveBeenCalled();
    });

    it("横書き時は左右端タップによるページめくりが発火しないこと（実効 scroll 固定）", () => {
      const onPageChange = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
          pagingMode: "paged",
          onPageChange,
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
      expect(onPageChange).not.toHaveBeenCalled();

      // 左端タップ（x = 30px < 60px）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      expect(onPageChange).not.toHaveBeenCalled();
    });
  });

  describe("連続スクロールモード（scroll）時の 2 段階遷移（ホイール ＆ スワイプ操作・Touch Event 対応）", () => {
    it("末尾到達後、1回目のホイール操作で案内ヒント表示、2.5秒以内の2回目で次話遷移すること", () => {
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

      // 第2段階（1回目）: 末尾到達状態からのさらなる下ホイール操作
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 20 }));
      });
      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      // 第2段階（2回目）: 2.5秒以内の再ホイール操作
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 20 }));
      });
      expect(defaultOptions.onNextChapter).toHaveBeenCalledTimes(1);
      expect(result.current.boundaryHint).toBeNull();
    });

    it("先頭到達後、1回目のホイール操作で案内ヒント表示、2.5秒以内の2回目で前話遷移すること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          chapterIndex: 2,
        }),
      );

      // 第1段階: スクロールで先頭到達
      act(() => {
        result.current.handleScrollProgressChange(0.0);
      });
      expect(defaultOptions.onPrevChapter).not.toHaveBeenCalled();

      // 第2段階（1回目）: 上ホイール操作
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: -20 }));
      });
      expect(defaultOptions.onPrevChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで前の話へ");

      // 第2段階（2回目）: 2.5秒以内の再ホイール操作
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: -20 }));
      });
      expect(defaultOptions.onPrevChapter).toHaveBeenCalledTimes(1);
      expect(result.current.boundaryHint).toBeNull();
    });

    it("末尾到達後に途中位置へ戻った場合、案内ヒントが消去されホイール操作しても次話遷移しないこと", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
        }),
      );

      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 20 }));
      });
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      // 途中に戻る
      act(() => {
        result.current.handleScrollProgressChange(0.5);
      });
      expect(result.current.boundaryHint).toBeNull();

      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 20 }));
      });
      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();
    });

    it("縦書きスクロールで末尾到達後、ポインタードラッグの2回操作で次話遷移すること", () => {
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

      // 第2段階（1回目）: 左方向へスワイプ（進む方向: dx < -30）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 150, clientY: 100 }),
        );
      });

      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      // 第2段階（2回目）: 2.5秒以内の2回目スワイプ
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 150, clientY: 100 }),
        );
      });

      expect(defaultOptions.onNextChapter).toHaveBeenCalledTimes(1);
      expect(result.current.boundaryHint).toBeNull();
    });

    it("縦書きスクロールで先頭到達後、ポインタードラッグの2回操作で前話遷移すること", () => {
      const onPrevChapter = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          writingMode: "vertical-rl",
          chapterIndex: 2,
          totalChapters: 4,
          onPrevChapter,
        }),
      );

      // 第1段階: 先頭到達
      act(() => {
        result.current.handleScrollProgressChange(0.0);
      });

      // 第2段階（1回目）: 右方向へスワイプ（戻る方向: dx > 30）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 150, clientY: 100 }),
        );
      });

      expect(onPrevChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで前の話へ");

      // 第2段階（2回目）: 2.5秒以内の2回目スワイプ
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 150, clientY: 100 }),
        );
      });

      expect(onPrevChapter).toHaveBeenCalledTimes(1);
      expect(result.current.boundaryHint).toBeNull();
    });

    it("横書きスクロールで末尾・先頭到達後、ポインタードラッグ操作で次話・前話遷移すること、および同一ジェスチャー内の再トリガー抑止", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          writingMode: "horizontal-tb",
          chapterIndex: 2,
          totalChapters: 4,
        }),
      );

      // 1. 末尾到達での上スワイプ（dy < -30）
      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 200 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 150 }),
        );
      });
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      // 同一ジェスチャー内でのさらなる移動は無視されること
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 100 }),
        );
      });
      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();

      // ポインター離上
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 100 }),
        );
      });

      // 2. 先頭到達での下スワイプ（dy > 30）
      act(() => {
        result.current.handleScrollProgressChange(0.0);
      });
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 150 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 150 }),
        );
      });
      expect(result.current.boundaryHint).toBe("もう一度スワイプで前の話へ");

      // 3. 中間位置でのポインタースワイプは何もしないこと
      act(() => {
        result.current.handleScrollProgressChange(0.5);
      });
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 150 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 150 }),
        );
      });
    });

    it("Touch Event（handleTouchStart, handleTouchMove, handleTouchEnd）による2段階スワイプで次話遷移すること", () => {
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

      // 1回目のタッチスワイプ（dx = -50）
      act(() => {
        result.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 200, clientY: 100 }]),
        );
        result.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 150, clientY: 100 }]),
        );
        result.current.handleTouchEnd?.(
          createTouchEvent("touchend", [{ clientX: 150, clientY: 100 }]),
        );
      });

      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      // 2.5秒以内の2回目タッチスワイプ
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 200, clientY: 100 }]),
        );
        result.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 150, clientY: 100 }]),
        );
        result.current.handleTouchEnd?.(
          createTouchEvent("touchend", [{ clientX: 150, clientY: 100 }]),
        );
      });

      expect(defaultOptions.onNextChapter).toHaveBeenCalledTimes(1);
      expect(result.current.boundaryHint).toBeNull();
    });

    it("scroll モードで touchstart 後に WebView による pointercancel が発生しても touch 追跡が維持され次話遷移できること (R1-27)", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          writingMode: "vertical-rl",
        }),
      );

      // 末尾到達
      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });

      // 1回目のタッチ操作: touchstart → pointercancel → touchmove → touchend
      act(() => {
        result.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 200, clientY: 100 }]),
        );
        // Android WebView がスクロール判定で pointercancel を発火
        result.current.handlePointerCancel();
        result.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 150, clientY: 100 }]),
        );
        result.current.handleTouchEnd?.(
          createTouchEvent("touchend", [{ clientX: 150, clientY: 100 }]),
        );
      });

      // pointercancel で touchStartRef が消去されず、1回目の境界ヒントが表示されること
      expect(defaultOptions.onNextChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      // 2回目タッチ操作（2.5秒以内）: touchstart → pointercancel → touchmove
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 200, clientY: 100 }]),
        );
        result.current.handlePointerCancel();
        result.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 150, clientY: 100 }]),
        );
        result.current.handleTouchEnd?.(
          createTouchEvent("touchend", [{ clientX: 150, clientY: 100 }]),
        );
      });

      expect(defaultOptions.onNextChapter).toHaveBeenCalledTimes(1);
    });

    it("横書き連続スクロールモードでの2段階スワイプ（dy < -30 で次話、dy > 30 で前話）", () => {
      const onNextChapter = vi.fn();
      const onPrevChapter = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          writingMode: "horizontal-tb",
          chapterIndex: 2,
          totalChapters: 4,
          onNextChapter,
          onPrevChapter,
        }),
      );

      // 末尾到達後、上スワイプ（dy < -30）の2回操作で次話
      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });
      // 1回目
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 200 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 150 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 150 }),
        );
      });
      expect(onNextChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      // 2回目
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 200 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 150 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 150 }),
        );
      });
      expect(onNextChapter).toHaveBeenCalledTimes(1);

      // 先頭到達後、下スワイプ（dy > 30）の2回操作で前話
      act(() => {
        result.current.handleScrollProgressChange(0.0);
      });
      // 1回目
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 150 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 150 }),
        );
      });
      expect(onPrevChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで前の話へ");

      // 2回目
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 100, clientY: 150 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 150 }),
        );
      });
      expect(onPrevChapter).toHaveBeenCalledTimes(1);
    });

    it("連続スクロールモードで作品端話（chapterIndex=totalChapters / chapterIndex=1）のときは遷移しないこと", () => {
      const onNextChapter = vi.fn();
      const onPrevChapter = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          chapterIndex: 5,
          totalChapters: 5,
          onNextChapter,
          onPrevChapter,
        }),
      );

      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 20 }));
      });
      expect(onNextChapter).not.toHaveBeenCalled();

      const { result: firstResult } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          chapterIndex: 1,
          totalChapters: 5,
          onNextChapter,
          onPrevChapter,
        }),
      );

      act(() => {
        firstResult.current.handleScrollProgressChange(0.0);
      });
      act(() => {
        firstResult.current.handleWheel(createWheelEvent({ deltaY: -20 }));
      });
      expect(onPrevChapter).not.toHaveBeenCalled();
    });

    it("縦書きスクロールモードで deltaX による水平ホイール操作で遷移すること", () => {
      const onNextChapter = vi.fn();
      const onPrevChapter = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          writingMode: "vertical-rl",
          chapterIndex: 2,
          totalChapters: 4,
          onNextChapter,
          onPrevChapter,
        }),
      );

      // 末尾到達後、2回の水平ホイール操作で次話へ
      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaX: -30 }));
      });
      expect(onNextChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaX: -30 }));
      });
      expect(onNextChapter).toHaveBeenCalledTimes(1);

      // 先頭到達後、2回の水平ホイール操作で前話へ
      act(() => {
        result.current.handleScrollProgressChange(0.0);
      });
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaX: 30 }));
      });
      expect(onPrevChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで前の話へ");

      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaX: 30 }));
      });
      expect(onPrevChapter).toHaveBeenCalledTimes(1);
    });

    it("横書きスクロールモードで deltaY によるホイール操作で遷移すること", () => {
      const onNextChapter = vi.fn();
      const onPrevChapter = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          writingMode: "horizontal-tb",
          chapterIndex: 2,
          totalChapters: 4,
          onNextChapter,
          onPrevChapter,
        }),
      );

      // 末尾到達後、2回の垂直ホイール操作で次話へ
      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 30 }));
      });
      expect(onNextChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 30 }));
      });
      expect(onNextChapter).toHaveBeenCalledTimes(1);

      // 先頭到達後、2回の垂直ホイール操作で前話へ
      act(() => {
        result.current.handleScrollProgressChange(0.0);
      });
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: -30 }));
      });
      expect(onPrevChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで前の話へ");

      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: -30 }));
      });
      expect(onPrevChapter).toHaveBeenCalledTimes(1);
    });

    it("scrollモードで pointercancel および pointerup が発生した場合は状態がリセットされること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
      });
      act(() => {
        result.current.handlePointerCancel();
      });
      expect(result.current.slideOffsetPx).toBe(0);

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
      });
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 100, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("pagedモード時、handleWheel は無視されること", () => {
      const onNextChapter = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "paged",
          onNextChapter,
        }),
      );

      act(() => {
        result.current.handleWheel(createWheelEvent({ deltaY: 50 }));
      });
      expect(onNextChapter).not.toHaveBeenCalled();
    });
  });

  describe("追加エッジケース・分岐網羅の検証", () => {
    it("touchStartRef が null の状態で handlePointerMove や handlePointerUp が呼ばれても安全に無視されること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 150, clientY: 100 }),
        );
      });

      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("handleMainClick はタップ直後は無視され、それ以外では onCloseOverlay が呼ばれること", () => {
      const onCloseOverlay = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          onCloseOverlay,
        }),
      );

      // タップ直前は onCloseOverlay が呼ばれる
      act(() => {
        result.current.handleMainClick();
      });
      expect(onCloseOverlay).toHaveBeenCalledTimes(1);

      // タップ操作発生
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 150, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 150, clientY: 100 }),
        );
      });

      // タップ直後の handleMainClick はスキップされる
      act(() => {
        result.current.handleMainClick();
      });
      expect(onCloseOverlay).toHaveBeenCalledTimes(1);

      // タイマー経過後は再度 onCloseOverlay が呼べる
      vi.advanceTimersByTime(150);
      act(() => {
        result.current.handleMainClick();
      });
      expect(onCloseOverlay).toHaveBeenCalledTimes(2);
    });

    it("縦書き端ページ（currentPage=totalPagesまたはcurrentPage=1）でのタップ時は範囲外へのページ送りを抑制すること", () => {
      const onPageChange = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: 4,
          totalPages: 4,
          onPageChange,
        }),
      );

      // 最終ページで左端タップ（次ページ送り）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      expect(onPageChange).not.toHaveBeenCalled();

      // 第1ページで右端タップ（前ページ送り）
      const { result: firstResult } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: 1,
          totalPages: 4,
          onPageChange,
        }),
      );

      act(() => {
        firstResult.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
        );
        firstResult.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
        );
      });
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it("横書き端ページでのタップ時は範囲外へのページ送りを抑制すること", () => {
      const onPageChange = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
          currentPage: 4,
          totalPages: 4,
          onPageChange,
        }),
      );

      // 横書き最終ページで右端タップ（次ページ送り）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
        );
      });
      expect(onPageChange).not.toHaveBeenCalled();

      // 横書き第1ページで左端タップ（前ページ送り）
      const { result: firstResult } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
          currentPage: 1,
          totalPages: 4,
          onPageChange,
        }),
      );

      act(() => {
        firstResult.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        firstResult.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it("横書きモード時は paged 指定時でもスクロール固定となりドラッグによる境界遷移やページめくりが発火しないこと (v0.5 Issue #168, #173)", () => {
      const onNextChapter = vi.fn();
      const onPrevChapter = vi.fn();
      const onPageChange = vi.fn();

      // 横書き最終ページで次へドラッグ（dx < -90）しても実効 scroll のため boundaryHint は表示されず次話遷移もしない
      const { result: nextResult } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
          pagingMode: "paged",
          currentPage: 4,
          totalPages: 4,
          chapterIndex: 2,
          totalChapters: 5,
          onNextChapter,
        }),
      );

      act(() => {
        nextResult.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 200, clientY: 100 }),
        );
        nextResult.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 80, clientY: 100 }), // dx = -120
        );
      });
      expect(nextResult.current.boundaryHint).toBeNull();

      act(() => {
        nextResult.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 80, clientY: 100 }),
        );
      });
      expect(onNextChapter).not.toHaveBeenCalled();

      // 横書き第1ページで前へドラッグ（dx > 90）しても boundaryHint は表示されず前話遷移もしない
      const { result: prevResult } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
          pagingMode: "paged",
          currentPage: 1,
          totalPages: 4,
          chapterIndex: 2,
          totalChapters: 5,
          onPrevChapter,
        }),
      );

      act(() => {
        prevResult.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        prevResult.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 220, clientY: 100 }), // dx = +120
        );
      });
      expect(prevResult.current.boundaryHint).toBeNull();

      act(() => {
        prevResult.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 220, clientY: 100 }),
        );
      });
      expect(onPrevChapter).not.toHaveBeenCalled();

      // 横書きエピソード内で前ページ送り操作（dx > 90）してもページ送りは発火しない
      const { result: pageResult } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
          pagingMode: "paged",
          currentPage: 3,
          totalPages: 4,
          onPageChange,
        }),
      );

      act(() => {
        pageResult.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        pageResult.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 200, clientY: 100 }), // dx = +100
        );
        pageResult.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 200, clientY: 100 }),
        );
      });
      expect(onPageChange).not.toHaveBeenCalled();
    });

    it("ページめくり確定時およびスナップバック時の isAnimating アニメーションタイマー動作", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 200, clientY: 100 }),
        );
      });

      expect(result.current.isAnimating).toBe(true);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.isAnimating).toBe(false);

      // スナップバック時
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 120, clientY: 100 }),
        );
        vi.advanceTimersByTime(400);
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 120, clientY: 100 }),
        );
      });

      expect(result.current.isAnimating).toBe(true);
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.isAnimating).toBe(false);
    });

    it("containerRef がない場合でもフォールバック幅（window.innerWidth または 375）で動作すること", () => {
      const onToggleOverlay = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          containerRef: undefined,
          onToggleOverlay,
        }),
      );

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
      });

      expect(result.current.slideOffsetPx).toBe(50);

      // タップ操作時も containerRef がない場合 e.clientX がそのまま使用される
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 500, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 500, clientY: 100 }),
        );
      });
      // 500 / 1024 = 0.488 (中央60%)
      expect(onToggleOverlay).toHaveBeenCalled();
    });

    it("アニメーション進行中等にアンマウントされた場合、タイマーが確実に破棄されること (R1-25(7))", () => {
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
      const { result, unmount } = renderHook(() =>
        useReaderGestures(defaultOptions),
      );

      // ドラッグ終了でアニメーション開始
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 200, clientY: 100 }),
        );
      });

      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("タッチイベントのガード条件およびエッジケースが網羅されること", () => {
      const onPrevChapter = vi.fn();
      const onNextChapter = vi.fn();
      const { result, unmount } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          chapterIndex: 2,
          totalChapters: 4,
          onPrevChapter,
          onNextChapter,
        }),
      );

      // touches が空の touchstart
      act(() => {
        result.current.handleTouchStart?.(createTouchEvent("touchstart", []));
      });

      // touches が空の touchmove
      act(() => {
        result.current.handleTouchMove?.(createTouchEvent("touchmove", []));
      });

      // touchStart がない状態での touchmove
      act(() => {
        result.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 100, clientY: 100 }]),
        );
      });

      // 前話方向へのタッチスワイプ（wasAtStartOnDownRef）
      act(() => {
        result.current.handleScrollProgressChange(0.0);
        result.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]),
        );
        result.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 150, clientY: 100 }]),
        );
      });
      expect(result.current.boundaryHint).toBe("もう一度スワイプで前の話へ");

      // 同一ジェスチャー内でのさらなる移動は無視されること（hasTriggeredInGestureRef）
      act(() => {
        result.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 160, clientY: 100 }]),
        );
      });
      expect(onPrevChapter).not.toHaveBeenCalled();

      // touchEnd でジェスチャー終了
      act(() => {
        result.current.handleTouchEnd?.();
      });

      // 2回目の前話タッチスワイプ
      vi.advanceTimersByTime(500);
      act(() => {
        result.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]),
        );
        result.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 150, clientY: 100 }]),
        );
        result.current.handleTouchEnd?.();
      });
      expect(onPrevChapter).toHaveBeenCalledTimes(1);

      // touchCancel の呼び出し
      act(() => {
        result.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]),
        );
        result.current.handleTouchCancel?.();
      });

      // 横書き（horizontal-tb）スクロールでの TouchMove
      const { result: horizontalTouchResult } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          writingMode: "horizontal-tb",
          pagingMode: "scroll",
          chapterIndex: 2,
          totalChapters: 4,
          onPrevChapter,
          onNextChapter,
        }),
      );

      // 末尾から上スワイプ（dy < -30: 次話へ）
      act(() => {
        horizontalTouchResult.current.handleScrollProgressChange(1.0);
        horizontalTouchResult.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]),
        );
        horizontalTouchResult.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 100, clientY: 50 }]),
        );
        horizontalTouchResult.current.handleTouchEnd?.();
      });
      expect(horizontalTouchResult.current.boundaryHint).toBe(
        "もう一度スワイプで次の話へ",
      );

      // 先頭から下スワイプ（dy > 30: 前話へ）
      act(() => {
        horizontalTouchResult.current.handleScrollProgressChange(0.0);
        horizontalTouchResult.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]),
        );
        horizontalTouchResult.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 100, clientY: 150 }]),
        );
        horizontalTouchResult.current.handleTouchEnd?.();
      });
      expect(horizontalTouchResult.current.boundaryHint).toBe(
        "もう一度スワイプで前の話へ",
      );

      // 中間位置での touchmove は何も発火しないこと
      act(() => {
        horizontalTouchResult.current.handleScrollProgressChange(0.5);
        horizontalTouchResult.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]),
        );
        horizontalTouchResult.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 100, clientY: 50 }]),
        );
        horizontalTouchResult.current.handleTouchEnd?.();
      });

      // paged モード時の touchMove は何もしないこと
      const { result: pagedResult } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "paged",
        }),
      );
      act(() => {
        pagedResult.current.handleTouchStart?.(
          createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]),
        );
        pagedResult.current.handleTouchMove?.(
          createTouchEvent("touchmove", [{ clientX: 150, clientY: 100 }]),
        );
      });

      unmount();
    });

    it("連続スクロール端での1回目スワイプ後、2.5秒無操作で案内ヒントが自動消去されること（次話および前話）", () => {
      const onNextChapter = vi.fn();
      const onPrevChapter = vi.fn();
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          pagingMode: "scroll",
          chapterIndex: 2,
          totalChapters: 4,
          onNextChapter,
          onPrevChapter,
        }),
      );

      // 1. 次話スワイプ（末尾到達後の次話ホイール）
      act(() => {
        result.current.handleScrollProgressChange(1.0);
      });
      act(() => {
        result.current.handleWheel?.(
          createWheelEvent({
            deltaX: -60,
            deltaY: 0,
          }),
        );
      });
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      // 2.5秒経過して消去されること
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(result.current.boundaryHint).toBeNull();

      // 2.5秒経過後のホイールは再度1回目扱いとなること
      act(() => {
        result.current.handleWheel?.(
          createWheelEvent({
            deltaX: -60,
            deltaY: 0,
          }),
        );
      });
      expect(onNextChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで次の話へ");

      // 2. 前話スワイプ（先頭到達後の前話ホイール）
      act(() => {
        result.current.handleScrollProgressChange(0.0);
      });
      act(() => {
        result.current.handleWheel?.(
          createWheelEvent({
            deltaX: 60,
            deltaY: 0,
          }),
        );
      });
      expect(result.current.boundaryHint).toBe("もう一度スワイプで前の話へ");

      // 2.5秒経過して消去されること
      act(() => {
        vi.advanceTimersByTime(2500);
      });
      expect(result.current.boundaryHint).toBeNull();

      // 2.5秒経過後のホイールは再度1回目扱いとなること
      act(() => {
        result.current.handleWheel?.(
          createWheelEvent({
            deltaX: 60,
            deltaY: 0,
          }),
        );
      });
      expect(onPrevChapter).not.toHaveBeenCalled();
      expect(result.current.boundaryHint).toBe("もう一度スワイプで前の話へ");
    });

    it("アニメーション進行中に次のジェスチャーが確定した場合、既存のアニメーションタイマーがクリアされること (R1-25(7))", () => {
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      // 1回目のドラッグ終了（アニメーション開始）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 200, clientY: 100 }),
        );
      });

      // 200ms 以内に 2回目のドラッグ終了（既存アニメーションタイマーをクリアして再セット）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 200, clientY: 100 }),
        );
      });

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("水平スライドアニメーションおよび高速連打即時確定 (AC-RD-17, Issue #201)", () => {
    it("左端タップ時: 直後に +pageWidth へスライドアニメーション開始し、200ms 後に onPageChange が確定してリセットされること (AC-RD-17a)", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
      });
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });

      // 直後: isAnimating=true, slideOffsetPx=300, onPageChange 未実行
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 100ms 経過: まだアニメーション中
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 200ms 到達: 確定 ＆ リセット
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("右端タップ時: 直後に -pageWidth へスライドアニメーション開始し、200ms 後に onPageChange が確定してリセットされること (AC-RD-17a)", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
        );
      });
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
        );
      });

      // 直後: isAnimating=true, slideOffsetPx=-300, onPageChange 未実行
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(-300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 200ms 到達: 確定 ＆ リセット
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(1);
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("スワイプ確定離上時: 直後に目標幅（次: +width, 前: -width）へ滑り切りアニメーションし、200ms 後に onPageChange が確定すること (AC-RD-17b)", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      // 次ページ方向スワイプ（dx = +100px）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 200, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(100);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 200, clientY: 100 }),
        );
      });
      // 離上直後は +width (300) へ滑り切り
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 200ms 経過で確定
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("スナップバック時: 離上直後に slideOffsetPx=0, isAnimating=true となり、200ms 後に isAnimating=false となること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      // 30% 未満の移動（dx = +40px）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 140, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(40);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 140, clientY: 100 }),
        );
      });
      // スナップバック直後
      expect(result.current.slideOffsetPx).toBe(0);
      expect(result.current.isAnimating).toBe(true);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 200ms 経過
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.isAnimating).toBe(false);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();
    });

    it("高速連続タップ時: アニメーション中に次のタップが来た場合、保留中の遷移が即時確定されて次のページへ連続遷移すること (AC-RD-17c)", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      // 1回目の左端タップ（2 -> 3 へのアニメーション開始）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
      });
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // 100ms 後（アニメーション完了前）に 2回目の左端タップ開始（pointerdown）
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
      });
      // 2回目の pointerdown 時点で 1回目の保留遷移（3）が即時確定される！
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(defaultOptions.onPageChange).toHaveBeenCalledTimes(1);

      // 2回目のタップ離上（pointerup）: 新ベースページ 3 から 4 へのアニメーション開始
      vi.advanceTimersByTime(40);
      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);

      // 200ms 後に 2回目の遷移（4）が確定
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(4);
      expect(defaultOptions.onPageChange).toHaveBeenCalledTimes(2);
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.slideOffsetPx).toBe(0);
    });

    it("スライドアニメーション中に逆方向タップが来た場合: 保留中が即時確定され、新ベースから逆方向のアニメーションが開始されること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      // 1回目の左端タップ（2 -> 3 へのアニメーション開始）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);

      // アニメーション中に右端タップ（前ページ）
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
        );
      });
      // 1回目の 3 が即時確定
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
        );
      });
      // 3 から前ページ 2 へ戻るアニメーション（slideOffsetPx = -300）開始
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(-300);

      // 200ms 後に 2 が確定
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(2);
      expect(defaultOptions.onPageChange).toHaveBeenCalledTimes(2);
    });

    it("スライドアニメーション中にドラッグが開始された場合: 保留中が即時確定され、ドラッグにリアルタイム追従すること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      // 左端タップ（2 -> 3 アニメーション開始）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });

      // アニメーション中に pointerdown
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
      });
      // 保留中の 3 が即時確定
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
      expect(result.current.isAnimating).toBe(false);
      expect(result.current.slideOffsetPx).toBe(0);

      // ドラッグ追従（dx = +50px）
      act(() => {
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 150, clientY: 100 }),
        );
      });
      expect(result.current.slideOffsetPx).toBe(50);
    });

    it("スワイプ離上アニメーション中に連打タップが発生した場合: 保留遷移が即時確定されること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      // スワイプ離上（dx = +100px -> 3 へのアニメーション開始）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 200, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 200, clientY: 100 }),
        );
      });
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);

      // アニメーション中に左端タップ
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      // 3 から 4 へのアニメーション
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(4);
    });

    it("スナップバックアニメーション中に操作が発生した場合: pending なしのため余分な onPageChange を呼ばずに次操作が開始されること", () => {
      const { result } = renderHook(() => useReaderGestures(defaultOptions));

      // スナップバック（dx = 40px で離上）
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 100, clientY: 100 }),
        );
        result.current.handlePointerMove(
          createPointerEvent("pointermove", { clientX: 140, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 140, clientY: 100 }),
        );
      });
      expect(result.current.isAnimating).toBe(true);
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();

      // スナップバックアニメーション中に左端タップ
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      // スナップバック中だったため確定対象はなく、新タップ（2 -> 3）が開始される
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();
      expect(result.current.isAnimating).toBe(true);
      expect(result.current.slideOffsetPx).toBe(300);

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(3);
    });

    it("端ページ到達時の連続タップ: 最終ページへのスライドアニメーション中に再度次へタップした際、最終ページが即時確定され端2段階ヒントへ移行すること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: 3,
          totalPages: 4,
          chapterIndex: 1,
          totalChapters: 3,
        }),
      );

      // 3 から 4 への左端タップ
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      expect(result.current.isAnimating).toBe(true);

      // アニメーション中に再度左端タップ
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
      });
      // 4 が即時確定
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(4);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      // 4 は totalPages に達しているため、次ページスライドではなく 2段階タップの案内ヒントが表示される
      expect(result.current.boundaryHint).toBe("もう一度タップで次の話へ");
    });

    it("第1ページ到達時の連続タップ: 第1ページへのスライドアニメーション中に再度前へタップした際、第1ページが即時確定され端2段階ヒントへ移行すること", () => {
      const { result } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: 2,
          totalPages: 4,
          chapterIndex: 2,
          totalChapters: 3,
        }),
      );

      // 2 から 1 への右端タップ
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
        );
      });
      expect(result.current.isAnimating).toBe(true);

      // アニメーション中に再度右端タップ
      vi.advanceTimersByTime(50);
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 270, clientY: 100 }),
        );
      });
      // 1 が即時確定
      expect(defaultOptions.onPageChange).toHaveBeenCalledWith(1);

      act(() => {
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 270, clientY: 100 }),
        );
      });
      // 1 は 第1ページのため、前ページスライドではなく 2段階タップの案内ヒントが表示される
      expect(result.current.boundaryHint).toBe("もう一度タップで前の話へ");
    });

    it("アニメーション進行中にアンマウントされた場合、タイマーが破棄されて未確定コールバックが発火しないこと", () => {
      const { result, unmount } = renderHook(() =>
        useReaderGestures(defaultOptions),
      );

      // 左端タップでアニメーション開始
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      expect(result.current.isAnimating).toBe(true);

      // アンマウント
      unmount();

      // タイマー時間を進める
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // アンマウント後は onPageChange が呼ばれないこと
      expect(defaultOptions.onPageChange).not.toHaveBeenCalled();
    });

    it("props の currentPage が更新された場合、連打基準ページが適切に同期されること", () => {
      let currentPg = 2;
      const { result, rerender } = renderHook(() =>
        useReaderGestures({
          ...defaultOptions,
          currentPage: currentPg,
          onPageChange: (p) => {
            currentPg = p;
          },
        }),
      );

      // 1回目のタップ
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });

      // 200ms 経過で確定
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(currentPg).toBe(3);

      // 親コンポーネントが currentPage を 3 に更新して rerender
      rerender();

      // さらにタップして 4 へ進める
      act(() => {
        result.current.handlePointerDown(
          createPointerEvent("pointerdown", { clientX: 30, clientY: 100 }),
        );
        result.current.handlePointerUp(
          createPointerEvent("pointerup", { clientX: 30, clientY: 100 }),
        );
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(currentPg).toBe(4);
    });
  });
});
