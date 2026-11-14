import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./SettingsPage.stories";
import { SettingsPage } from "./SettingsPage";
import * as sampleTextPreviewModule from "./SampleTextPreview";
import * as cloudSyncSectionModule from "./CloudSyncSection";
import * as storageCacheSectionModule from "./StorageCacheSection";

const {
  Default,
  HorizontalSepia,
  MinBoundaries,
  MaxBoundaries,
  Loading,
  WithError,
  CloudSyncConnected,
  PagingModeSelection,
  HorizontalWithPagingModeDisabled,
  FontSelectionKlee,
  WithStorageCache,
  WithStorageCacheDialogOpen,
  VolumeKeyPagingEnabled,
} = composeStories(stories);

describe("SettingsPage", () => {
  describe("Storybook Stories 描画検証 (composeStories)", () => {
    it("Default: 縦書き・ライトテーマ、既定ステッパー値、およびプレビュー・各セクションへの Props 伝達が正しく行われること (AC-ST-01, AC-ST-02, AC-ST-17, AC-ST-18)", () => {
      const sampleTextPreviewSpy = vi
        .spyOn(sampleTextPreviewModule, "SampleTextPreview")
        .mockImplementation(() => null);
      const cloudSyncSectionSpy = vi
        .spyOn(cloudSyncSectionModule, "CloudSyncSection")
        .mockImplementation(() => null);
      const storageCacheSectionSpy = vi
        .spyOn(storageCacheSectionModule, "StorageCacheSection")
        .mockImplementation(() => null);
      try {
        render(<Default />);

        // 画面ルート
        const page = screen.getByTestId("settings-page");
        expect(page).toBeInTheDocument();
        expect(page).toHaveClass(
          "h-full",
          "flex",
          "flex-col",
          "overflow-y-auto",
        );
        expect(page).toHaveAttribute("data-font-family", "biz-ud-mincho");
        expect(page).toHaveAttribute("data-page-margin", "20");

        // ヘッダー
        const header = screen.getByTestId("settings-header");
        expect(header).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { level: 1, name: "設定" }),
        ).toBeInTheDocument();

        // 組版設定セクション
        const typographySection = screen.getByTestId(
          "typography-settings-section",
        );
        expect(typographySection).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { level: 2, name: "組版・表示設定" }),
        ).toBeInTheDocument();

        // 組み方向切替（vertical-rl 時は「横書き表示に切替」）
        const toggleButton = screen.getByTestId("toggle-orientation");
        expect(toggleButton).toHaveTextContent("横書き表示に切替");
        expect(toggleButton).toBeEnabled();

        // ページ送りモードセレクター（初期値: auto の場合も 2 択化により paged が選択状態、enabled、注記は非表示） (AC-ST-13)
        const pagingModeSelect = screen.getByTestId("paging-mode-select");
        expect(pagingModeSelect).toBeInTheDocument();
        expect(pagingModeSelect).toHaveValue("paged");
        expect(pagingModeSelect).toBeEnabled();
        expect(
          screen.queryByTestId("paging-mode-note"),
        ).not.toBeInTheDocument();

        // カラーテーマ選択（ライトが選択中）
        const lightThemeBtn = screen.getByTestId("theme-light");
        const sepiaThemeBtn = screen.getByTestId("theme-sepia");
        const darkThemeBtn = screen.getByTestId("theme-dark");
        const blackThemeBtn = screen.getByTestId("theme-black");

        expect(lightThemeBtn).toHaveAttribute("aria-pressed", "true");
        expect(sepiaThemeBtn).toHaveAttribute("aria-pressed", "false");
        expect(darkThemeBtn).toHaveAttribute("aria-pressed", "false");
        expect(blackThemeBtn).toHaveAttribute("aria-pressed", "false");

        // フォント種別選択ドロップダウン（5種、UD明朝が初期値） (AC-ST-17)
        const fontSelect = screen.getByTestId("font-family-select");
        expect(fontSelect).toBeInTheDocument();
        expect(fontSelect).toHaveValue("biz-ud-mincho");
        expect(fontSelect).toBeEnabled();
        const options = fontSelect.querySelectorAll("option");
        expect(options).toHaveLength(5);
        expect(options[0]).toHaveValue("biz-ud-mincho");
        expect(options[1]).toHaveValue("mincho");
        expect(options[2]).toHaveValue("biz-ud-gothic");
        expect(options[3]).toHaveValue("gothic");
        expect(options[4]).toHaveValue("klee");

        // 文字サイズステッパー（18px）
        expect(screen.getByTestId("font-size-value")).toHaveTextContent("18px");
        expect(screen.getByTestId("font-size-decrease")).toBeEnabled();
        expect(screen.getByTestId("font-size-increase")).toBeEnabled();

        // 行間ステッパー（1.8）
        expect(screen.getByTestId("line-height-value")).toHaveTextContent(
          "1.8",
        );
        expect(screen.getByTestId("line-height-decrease")).toBeEnabled();
        expect(screen.getByTestId("line-height-increase")).toBeEnabled();

        // 画面余白ステッパー（20px） (AC-ST-18)
        expect(screen.getByTestId("page-margin-value")).toHaveTextContent(
          "20px",
        );
        expect(screen.getByTestId("page-margin-decrease")).toBeEnabled();
        expect(screen.getByTestId("page-margin-increase")).toBeEnabled();

        // 音量キーでページ送りトグル（初期値: false / aria-pressed="false"） (AC-ST-19)
        const volumeKeyToggle = screen.getByTestId("toggle-volume-key-paging");
        expect(volumeKeyToggle).toBeInTheDocument();
        expect(volumeKeyToggle).toHaveAttribute("role", "switch");
        expect(volumeKeyToggle).toHaveAttribute("aria-checked", "false");
        expect(volumeKeyToggle).toHaveAttribute("aria-pressed", "false");
        expect(volumeKeyToggle).toHaveAttribute(
          "aria-label",
          "音量キーでページ送り",
        );
        expect(volumeKeyToggle).toBeEnabled();
        expect(
          screen.getByText("音量［ー］で次へ、音量［＋］で前へ移動します"),
        ).toBeInTheDocument();

        // プレビューセクション
        const previewSection = screen.getByTestId("preview-section");
        expect(previewSection).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { level: 2, name: "組版プレビュー" }),
        ).toBeInTheDocument();

        // 子コンポーネント（SampleTextPreview / CloudSyncSection / StorageCacheSection）への Props 伝達確認 (R1-32, R1-05)
        expect(sampleTextPreviewSpy).toHaveBeenCalledWith(
          {
            writingMode: "vertical-rl",
            theme: "light",
            fontSizePx: 18,
            lineHeight: 1.8,
            fontFamily: "biz-ud-mincho",
            pageMarginPx: 20,
          },
          undefined,
        );
        expect(cloudSyncSectionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            authState: { status: "unlinked" },
          }),
          undefined,
        );
        expect(storageCacheSectionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            summary: { totalCachedChapters: 0, totalByteSize: 0 },
          }),
          undefined,
        );

        // バージョン表示フッター (AC-ST-20)
        const footer = screen.getByTestId("settings-version-footer");
        expect(footer).toBeInTheDocument();
        expect(footer).toHaveTextContent("Yommy v1.0.0");
      } finally {
        sampleTextPreviewSpy.mockRestore();
        cloudSyncSectionSpy.mockRestore();
        storageCacheSectionSpy.mockRestore();
      }
    });

    it("HorizontalSepia: 横書き・セピアテーマ表示が正しく反映され SampleTextPreview へ Props 伝達されること (AC-ST-03, AC-ST-04)", () => {
      const sampleTextPreviewSpy = vi
        .spyOn(sampleTextPreviewModule, "SampleTextPreview")
        .mockImplementation(() => null);
      const cloudSyncSectionSpy = vi
        .spyOn(cloudSyncSectionModule, "CloudSyncSection")
        .mockImplementation(() => null);
      const storageCacheSectionSpy = vi
        .spyOn(storageCacheSectionModule, "StorageCacheSection")
        .mockImplementation(() => null);
      try {
        render(<HorizontalSepia />);

        // 組み方向切替（horizontal-tb 時は「縦書き表示に切替」）
        const toggleButton = screen.getByTestId("toggle-orientation");
        expect(toggleButton).toHaveTextContent("縦書き表示に切替");

        // セピアテーマが選択状態
        expect(screen.getByTestId("theme-sepia")).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        expect(screen.getByTestId("theme-light")).toHaveAttribute(
          "aria-pressed",
          "false",
        );

        // SampleTextPreview への Props 伝達確認 (R1-32, R1-05)
        expect(sampleTextPreviewSpy).toHaveBeenCalledWith(
          {
            writingMode: "horizontal-tb",
            theme: "sepia",
            fontSizePx: 18,
            lineHeight: 1.8,
            fontFamily: "biz-ud-mincho",
            pageMarginPx: 20,
          },
          undefined,
        );

        // バージョン表示フッター (AC-ST-20)
        const footer = screen.getByTestId("settings-version-footer");
        expect(footer).toBeInTheDocument();
        expect(footer).toHaveTextContent("Yommy v1.0.0");
      } finally {
        sampleTextPreviewSpy.mockRestore();
        cloudSyncSectionSpy.mockRestore();
        storageCacheSectionSpy.mockRestore();
      }
    });

    it("MinBoundaries: 最小境界値（12px / 1.4 / 8px）で縮小ボタンが無効化されること (AC-ST-05, AC-ST-18)", () => {
      render(<MinBoundaries />);

      // ダークテーマ選択
      expect(screen.getByTestId("theme-dark")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // 文字サイズ 12px: 縮小ボタン無効、拡大ボタン有効
      expect(screen.getByTestId("font-size-value")).toHaveTextContent("12px");
      expect(screen.getByTestId("font-size-decrease")).toBeDisabled();
      expect(screen.getByTestId("font-size-increase")).toBeEnabled();

      // 行間 1.4: 縮小ボタン無効、拡大ボタン有効
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("1.4");
      expect(screen.getByTestId("line-height-decrease")).toBeDisabled();
      expect(screen.getByTestId("line-height-increase")).toBeEnabled();

      // 画面余白 8px: 縮小ボタン無効、拡大ボタン有効 (AC-ST-18)
      expect(screen.getByTestId("page-margin-value")).toHaveTextContent("8px");
      expect(screen.getByTestId("page-margin-decrease")).toBeDisabled();
      expect(screen.getByTestId("page-margin-increase")).toBeEnabled();
    });

    it("MaxBoundaries: 最大境界値（32px / 2.4 / 48px）で拡大ボタンが無効化されること (AC-ST-05, AC-ST-18)", () => {
      render(<MaxBoundaries />);

      // ブラックテーマ選択
      expect(screen.getByTestId("theme-black")).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      // 文字サイズ 32px: 縮小ボタン有効、拡大ボタン無効
      expect(screen.getByTestId("font-size-value")).toHaveTextContent("32px");
      expect(screen.getByTestId("font-size-decrease")).toBeEnabled();
      expect(screen.getByTestId("font-size-increase")).toBeDisabled();

      // 行間 2.4: 縮小ボタン有効、拡大ボタン無効
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("2.4");
      expect(screen.getByTestId("line-height-decrease")).toBeEnabled();
      expect(screen.getByTestId("line-height-increase")).toBeDisabled();

      // 画面余白 48px: 縮小ボタン有効、拡大ボタン無効 (AC-ST-18)
      expect(screen.getByTestId("page-margin-value")).toHaveTextContent("48px");
      expect(screen.getByTestId("page-margin-decrease")).toBeEnabled();
      expect(screen.getByTestId("page-margin-increase")).toBeDisabled();
    });

    it("Loading: isLoading が true のとき全操作ボタンが無効化されること", () => {
      render(<Loading />);

      // 組み方向切替
      expect(screen.getByTestId("toggle-orientation")).toBeDisabled();

      // 各テーマボタン
      expect(screen.getByTestId("theme-light")).toBeDisabled();
      expect(screen.getByTestId("theme-sepia")).toBeDisabled();
      expect(screen.getByTestId("theme-dark")).toBeDisabled();
      expect(screen.getByTestId("theme-black")).toBeDisabled();

      // フォント種別セレクター (AC-ST-17)
      expect(screen.getByTestId("font-family-select")).toBeDisabled();

      // 文字サイズステッパーボタン
      expect(screen.getByTestId("font-size-decrease")).toBeDisabled();
      expect(screen.getByTestId("font-size-increase")).toBeDisabled();

      // 行間ステッパーボタン
      expect(screen.getByTestId("line-height-decrease")).toBeDisabled();
      expect(screen.getByTestId("line-height-increase")).toBeDisabled();

      // 画面余白ステッパーボタン (AC-ST-18)
      expect(screen.getByTestId("page-margin-decrease")).toBeDisabled();
      expect(screen.getByTestId("page-margin-increase")).toBeDisabled();

      // ページ送りモードセレクター
      expect(screen.getByTestId("paging-mode-select")).toBeDisabled();

      // 音量キーでページ送りトグル (AC-ST-19)
      expect(screen.getByTestId("toggle-volume-key-paging")).toBeDisabled();
    });

    it("VolumeKeyPagingEnabled: 音量キー送りが有効時（true）に aria-pressed=true で描画されること (AC-ST-19)", () => {
      render(<VolumeKeyPagingEnabled />);

      const toggleBtn = screen.getByTestId("toggle-volume-key-paging");
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute("role", "switch");
      expect(toggleBtn).toHaveAttribute("aria-checked", "true");
      expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
      expect(toggleBtn).toBeEnabled();
    });

    it("FontSelectionKlee: 教科書体 Klee が選択状態として反映されること (AC-ST-17)", () => {
      render(<FontSelectionKlee />);

      const fontSelect = screen.getByTestId("font-family-select");
      expect(fontSelect).toBeInTheDocument();
      expect(fontSelect).toHaveValue("klee");

      const page = screen.getByTestId("settings-page");
      expect(page).toHaveAttribute("data-font-family", "klee");
    });

    it("PagingModeSelection: ページ送りモードで paged が選択状態として反映されること (AC-ST-13)", () => {
      render(<PagingModeSelection />);

      const pagingModeSelect = screen.getByTestId("paging-mode-select");
      expect(pagingModeSelect).toBeInTheDocument();
      expect(pagingModeSelect).toHaveValue("paged");
    });

    it("HorizontalWithPagingModeDisabled: 横書き時にページ送りセレクターが無効化され注記が表示されること (AC-ST-13)", () => {
      render(<HorizontalWithPagingModeDisabled />);

      const pagingModeSelect = screen.getByTestId("paging-mode-select");
      expect(pagingModeSelect).toBeDisabled();

      const note = screen.getByTestId("paging-mode-note");
      expect(note).toBeInTheDocument();
      expect(note).toHaveTextContent(
        "※横書き表示時は連続スクロール固定となります",
      );
    });

    it("WithStorageCache: ストレージ・キャッシュ情報と完了通知が StorageCacheSection へ正しく伝達されること (AC-ST-14, AC-ST-16)", () => {
      const storageCacheSectionSpy = vi
        .spyOn(storageCacheSectionModule, "StorageCacheSection")
        .mockImplementation(() => null);
      try {
        render(<WithStorageCache />);

        expect(storageCacheSectionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            summary: {
              totalCachedChapters: 12,
              totalByteSize: 1572864,
            },
            notice: "本文キャッシュを一括削除しました（4話）",
          }),
          undefined,
        );
      } finally {
        storageCacheSectionSpy.mockRestore();
      }
    });

    it("WithStorageCacheDialogOpen: initialShowDialog が StorageCacheSection に伝達されること (AC-ST-15)", () => {
      const storageCacheSectionSpy = vi
        .spyOn(storageCacheSectionModule, "StorageCacheSection")
        .mockImplementation(() => null);
      try {
        render(<WithStorageCacheDialogOpen />);

        expect(storageCacheSectionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            initialShowDialog: true,
          }),
          undefined,
        );
      } finally {
        storageCacheSectionSpy.mockRestore();
      }
    });
  });

  describe("ユーザー操作・イベント発火検証", () => {
    it("組み方向切替ボタン押下時に onToggleWritingMode が呼び出されること (AC-ST-03)", async () => {
      const user = userEvent.setup();
      const onToggleWritingMode = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={onToggleWritingMode}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      const button = screen.getByTestId("toggle-orientation");
      await user.click(button);

      expect(onToggleWritingMode).toHaveBeenCalledTimes(1);
    });

    it("ページ送りモードセレクターの選択肢が2択（paged/scroll）に整理され、選択時に onChangePagingMode が呼び出されること (AC-ST-13, v0.5 Issue #168, #173)", async () => {
      const user = userEvent.setup();
      const onChangePagingMode = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          pagingMode="auto"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
          onChangePagingMode={onChangePagingMode}
        />,
      );

      const select = screen.getByTestId("paging-mode-select");
      expect(select).toBeEnabled();
      expect(screen.queryByTestId("paging-mode-note")).not.toBeInTheDocument();

      // 選択肢が2択（paged: ページめくり（縦書き時）、scroll: 連続スクロール）であること
      const options = select.querySelectorAll("option");
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveValue("paged");
      expect(options[0]).toHaveTextContent("ページめくり（縦書き時）");
      expect(options[1]).toHaveValue("scroll");
      expect(options[1]).toHaveTextContent("連続スクロール");

      // auto が渡された場合も paged が選択状態であること
      expect(select).toHaveValue("paged");

      await user.selectOptions(select, "scroll");
      expect(onChangePagingMode).toHaveBeenLastCalledWith("scroll");

      await user.selectOptions(select, "paged");
      expect(onChangePagingMode).toHaveBeenLastCalledWith("paged");

      expect(onChangePagingMode).toHaveBeenCalledTimes(2);
    });

    it("横書き（horizontal-tb）時はページ送りセレクターが無効化され、注記メッセージが表示されること (AC-ST-13, v0.5 Issue #168, #173)", () => {
      render(
        <SettingsPage
          writingMode="horizontal-tb"
          theme="light"
          pagingMode="paged"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      const select = screen.getByTestId("paging-mode-select");
      expect(select).toBeDisabled();

      const note = screen.getByTestId("paging-mode-note");
      expect(note).toBeInTheDocument();
      expect(note).toHaveTextContent(
        "※横書き表示時は連続スクロール固定となります",
      );
    });

    it("pagingMode が scroll の場合はセレクターに scroll が選択状態として反映されること (AC-ST-13)", () => {
      const sampleSpy = vi
        .spyOn(sampleTextPreviewModule, "SampleTextPreview")
        .mockImplementation(() => null);
      const cloudSyncSpy = vi
        .spyOn(cloudSyncSectionModule, "CloudSyncSection")
        .mockImplementation(() => null);
      const storageCacheSpy = vi
        .spyOn(storageCacheSectionModule, "StorageCacheSection")
        .mockImplementation(() => null);

      try {
        render(
          <SettingsPage
            writingMode="vertical-rl"
            theme="light"
            pagingMode="scroll"
            onToggleWritingMode={vi.fn()}
            onChangeTheme={vi.fn()}
            onChangeFontSize={vi.fn()}
            onChangeLineHeight={vi.fn()}
          />,
        );

        expect(screen.getByTestId("paging-mode-select")).toHaveValue("scroll");
      } finally {
        sampleSpy.mockRestore();
        cloudSyncSpy.mockRestore();
        storageCacheSpy.mockRestore();
      }
    });

    it("各テーマボタン押下時に onChangeTheme が対応するテーマで呼び出されること (AC-ST-04)", async () => {
      const user = userEvent.setup();
      const onChangeTheme = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={onChangeTheme}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      await user.click(screen.getByTestId("theme-sepia"));
      expect(onChangeTheme).toHaveBeenLastCalledWith("sepia");

      await user.click(screen.getByTestId("theme-dark"));
      expect(onChangeTheme).toHaveBeenLastCalledWith("dark");

      await user.click(screen.getByTestId("theme-black"));
      expect(onChangeTheme).toHaveBeenLastCalledWith("black");

      await user.click(screen.getByTestId("theme-light"));
      expect(onChangeTheme).toHaveBeenLastCalledWith("light");

      expect(onChangeTheme).toHaveBeenCalledTimes(4);
    });

    it("文字サイズステッパー押下時に step 刻みで onChangeFontSize が呼び出されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      const onChangeFontSize = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={18}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={onChangeFontSize}
          onChangeLineHeight={vi.fn()}
        />,
      );

      // 縮小: 18 - 2 = 16
      await user.click(screen.getByTestId("font-size-decrease"));
      expect(onChangeFontSize).toHaveBeenLastCalledWith(16);

      // 拡大: 18 + 2 = 20
      await user.click(screen.getByTestId("font-size-increase"));
      expect(onChangeFontSize).toHaveBeenLastCalledWith(20);
    });

    it("文字サイズステッパーの境界クランプが安全に処理されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      const onChangeFontSize = vi.fn();

      const { rerender } = render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={13}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={onChangeFontSize}
          onChangeLineHeight={vi.fn()}
        />,
      );

      // 13px から縮小 -> Math.max(12, 13 - 2) = 12
      await user.click(screen.getByTestId("font-size-decrease"));
      expect(onChangeFontSize).toHaveBeenLastCalledWith(12);

      // 31px から拡大 -> Math.min(32, 31 + 2) = 32
      rerender(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          fontSizePx={31}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={onChangeFontSize}
          onChangeLineHeight={vi.fn()}
        />,
      );
      await user.click(screen.getByTestId("font-size-increase"));
      expect(onChangeFontSize).toHaveBeenLastCalledWith(32);
    });

    it("行間ステッパー押下時に step 刻みで onChangeLineHeight が呼び出されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      const onChangeLineHeight = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          lineHeight={1.8}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={onChangeLineHeight}
        />,
      );

      // 縮小: 1.8 - 0.2 = 1.6
      await user.click(screen.getByTestId("line-height-decrease"));
      expect(onChangeLineHeight).toHaveBeenLastCalledWith(1.6);

      // 拡大: 1.8 + 0.2 = 2.0
      await user.click(screen.getByTestId("line-height-increase"));
      expect(onChangeLineHeight).toHaveBeenLastCalledWith(2.0);
    });

    it("行間ステッパーの境界クランプが安全に処理されること (AC-ST-05)", async () => {
      const user = userEvent.setup();
      const onChangeLineHeight = vi.fn();

      const { rerender } = render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          lineHeight={1.5}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={onChangeLineHeight}
        />,
      );

      // 1.5 から縮小 -> Math.max(1.4, 1.3) -> 1.4 ではなく 1.5 - 0.2 = 1.3 -> max で 1.4
      await user.click(screen.getByTestId("line-height-decrease"));
      expect(onChangeLineHeight).toHaveBeenLastCalledWith(1.4);

      // 2.3 から拡大 -> Math.min(2.4, 2.5) -> min で 2.4
      rerender(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          lineHeight={2.3}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={onChangeLineHeight}
        />,
      );
      await user.click(screen.getByTestId("line-height-increase"));
      expect(onChangeLineHeight).toHaveBeenLastCalledWith(2.4);
    });

    it("フォント種別セレクター変更時に onChangeFontFamily が呼び出されること (AC-ST-17)", async () => {
      const user = userEvent.setup();
      const onChangeFontFamily = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
          onChangeFontFamily={onChangeFontFamily}
        />,
      );

      const fontSelect = screen.getByTestId("font-family-select");
      await user.selectOptions(fontSelect, "klee");
      expect(onChangeFontFamily).toHaveBeenCalledWith("klee");

      await user.selectOptions(fontSelect, "biz-ud-gothic");
      expect(onChangeFontFamily).toHaveBeenCalledWith("biz-ud-gothic");
    });

    it("画面余白ステッパー押下時に step 刻みで onChangePageMargin が呼び出されること (AC-ST-18)", async () => {
      const user = userEvent.setup();
      const onChangePageMargin = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          pageMarginPx={20}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
          onChangePageMargin={onChangePageMargin}
        />,
      );

      // 縮小: 20 - 4 = 16
      await user.click(screen.getByTestId("page-margin-decrease"));
      expect(onChangePageMargin).toHaveBeenLastCalledWith(16);

      // 拡大: 20 + 4 = 24
      await user.click(screen.getByTestId("page-margin-increase"));
      expect(onChangePageMargin).toHaveBeenLastCalledWith(24);
    });

    it("画面余白ステッパーの境界クランプが安全に処理されること (AC-ST-18)", async () => {
      const user = userEvent.setup();
      const onChangePageMargin = vi.fn();

      const { rerender } = render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          pageMarginPx={10}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
          onChangePageMargin={onChangePageMargin}
        />,
      );

      // 10px から縮小 -> Math.max(8, 10 - 4) = 8
      await user.click(screen.getByTestId("page-margin-decrease"));
      expect(onChangePageMargin).toHaveBeenLastCalledWith(8);

      // 46px から拡大 -> Math.min(48, 46 + 4) = 48
      rerender(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          pageMarginPx={46}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
          onChangePageMargin={onChangePageMargin}
        />,
      );
      await user.click(screen.getByTestId("page-margin-increase"));
      expect(onChangePageMargin).toHaveBeenLastCalledWith(48);
    });

    it("オプショナルプロパティ省略時にデフォルト値（18px, 1.8, UD明朝, 20px, isLoading: false）が適用されること", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      expect(screen.getByTestId("font-size-value")).toHaveTextContent("18px");
      expect(screen.getByTestId("line-height-value")).toHaveTextContent("1.8");
      expect(screen.getByTestId("font-family-select")).toHaveValue(
        "biz-ud-mincho",
      );
      expect(screen.getByTestId("page-margin-value")).toHaveTextContent("20px");
      expect(screen.getByTestId("toggle-orientation")).toBeEnabled();
    });

    it("カスタム className がルートコンテナへ適用されること", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          className="custom-test-class"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      const page = screen.getByTestId("settings-page");
      expect(page).toHaveClass("custom-test-class");
    });

    it("WithError ストーリーでエラーアラートが role='alert' として表示されること（R1-20）", () => {
      render(<WithError />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute("data-testid", "settings-error-alert");
      expect(alert).toHaveTextContent(
        "設定の保存に失敗しました。時間をおいて再試行してください。",
      );
    });

    it("CloudSyncConnected: クラウド同期セクションへ連携中状態が正しく伝達されること (AC-ST-08, AC-ST-09, R1-32)", () => {
      const cloudSyncSectionSpy = vi
        .spyOn(cloudSyncSectionModule, "CloudSyncSection")
        .mockImplementation(() => null);
      try {
        render(<CloudSyncConnected />);

        expect(cloudSyncSectionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            authState: {
              status: "connected",
              email: "user@example.com",
            },
          }),
          undefined,
        );
      } finally {
        cloudSyncSectionSpy.mockRestore();
      }
    });

    it("error が null または未指定の場合、エラーアラートが表示されないこと", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          error={null}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("settings-error-alert"),
      ).not.toBeInTheDocument();
    });

    it("クラウド同期セクションが統合され、連携・同期コールバックが正しく配線されること (AC-ST-08〜12, R1-32)", async () => {
      const cloudSyncSectionSpy = vi
        .spyOn(cloudSyncSectionModule, "CloudSyncSection")
        .mockImplementation(() => null);
      try {
        const onSignInGoogle = vi.fn().mockResolvedValue(undefined);
        const onSignOutGoogle = vi.fn().mockResolvedValue(undefined);
        const onSyncNow = vi.fn().mockResolvedValue(undefined);

        // 未連携表示
        const { rerender } = render(
          <SettingsPage
            writingMode="vertical-rl"
            theme="light"
            cloudSyncAuthState={{ status: "unlinked" }}
            onToggleWritingMode={vi.fn()}
            onChangeTheme={vi.fn()}
            onChangeFontSize={vi.fn()}
            onChangeLineHeight={vi.fn()}
            onSignInGoogle={onSignInGoogle}
            onSignOutGoogle={onSignOutGoogle}
            onSyncNow={onSyncNow}
          />,
        );

        expect(cloudSyncSectionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            authState: { status: "unlinked" },
            onSignIn: onSignInGoogle,
            onSignOut: onSignOutGoogle,
            onSyncNow: onSyncNow,
          }),
          undefined,
        );

        const passedProps1 = cloudSyncSectionSpy.mock.calls[0][0];
        passedProps1.onSignIn?.();
        expect(onSignInGoogle).toHaveBeenCalledTimes(1);

        // 連携中表示
        cloudSyncSectionSpy.mockClear();
        rerender(
          <SettingsPage
            writingMode="vertical-rl"
            theme="light"
            cloudSyncAuthState={{
              status: "connected",
              email: "test@example.com",
            }}
            cloudSyncLastSyncedAt="2026-10-31T12:00:00.000Z"
            onToggleWritingMode={vi.fn()}
            onChangeTheme={vi.fn()}
            onChangeFontSize={vi.fn()}
            onChangeLineHeight={vi.fn()}
            onSignInGoogle={onSignInGoogle}
            onSignOutGoogle={onSignOutGoogle}
            onSyncNow={onSyncNow}
          />,
        );

        expect(cloudSyncSectionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            authState: {
              status: "connected",
              email: "test@example.com",
            },
            lastSyncedAt: "2026-10-31T12:00:00.000Z",
            onSignIn: onSignInGoogle,
            onSignOut: onSignOutGoogle,
            onSyncNow: onSyncNow,
          }),
          undefined,
        );

        const passedProps2 = cloudSyncSectionSpy.mock.calls[0][0];
        passedProps2.onSyncNow?.();
        expect(onSyncNow).toHaveBeenCalledTimes(1);

        passedProps2.onSignOut?.();
        expect(onSignOutGoogle).toHaveBeenCalledTimes(1);
      } finally {
        cloudSyncSectionSpy.mockRestore();
      }
    });

    it("ストレージ・キャッシュ管理セクションが統合され、一括削除コールバックが正しく配線されること (AC-ST-14〜16)", async () => {
      const storageCacheSectionSpy = vi
        .spyOn(storageCacheSectionModule, "StorageCacheSection")
        .mockImplementation(() => null);
      try {
        const onClearStorageCache = vi.fn().mockResolvedValue(5);

        render(
          <SettingsPage
            writingMode="vertical-rl"
            theme="light"
            storageCacheSummary={{
              totalCachedChapters: 12,
              totalByteSize: 1048576,
            }}
            storageCacheNotice="本文キャッシュを一括削除しました（5話）"
            storageCacheError={null}
            onToggleWritingMode={vi.fn()}
            onChangeTheme={vi.fn()}
            onChangeFontSize={vi.fn()}
            onChangeLineHeight={vi.fn()}
            onClearStorageCache={onClearStorageCache}
          />,
        );

        expect(storageCacheSectionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            summary: {
              totalCachedChapters: 12,
              totalByteSize: 1048576,
            },
            notice: "本文キャッシュを一括削除しました（5話）",
            error: null,
            onClearCache: onClearStorageCache,
          }),
          undefined,
        );

        const passedProps = storageCacheSectionSpy.mock.calls[0][0];
        passedProps.onClearCache?.({ onlyRead: true });
        expect(onClearStorageCache).toHaveBeenCalledWith({ onlyRead: true });
      } finally {
        storageCacheSectionSpy.mockRestore();
      }
    });

    it("storageCacheSummary 省略時にデフォルトのキャッシュ0件（0話・0バイト）が適用されて StorageCacheSection へ渡されること (AC-ST-14)", () => {
      const storageCacheSectionSpy = vi
        .spyOn(storageCacheSectionModule, "StorageCacheSection")
        .mockImplementation(() => null);
      try {
        render(
          <SettingsPage
            writingMode="vertical-rl"
            theme="light"
            onToggleWritingMode={vi.fn()}
            onChangeTheme={vi.fn()}
            onChangeFontSize={vi.fn()}
            onChangeLineHeight={vi.fn()}
          />,
        );

        expect(storageCacheSectionSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            summary: { totalCachedChapters: 0, totalByteSize: 0 },
          }),
          undefined,
        );
      } finally {
        storageCacheSectionSpy.mockRestore();
      }
    });
  });

  describe("音量キーでページ送りトグル (AC-ST-19)", () => {
    it("クリック時に onToggleVolumeKeyPaging が呼び出されること", async () => {
      const user = userEvent.setup();
      const onToggleVolumeKeyPaging = vi.fn();

      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          enableVolumeKeyPaging={false}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
          onToggleVolumeKeyPaging={onToggleVolumeKeyPaging}
        />,
      );

      const toggleBtn = screen.getByTestId("toggle-volume-key-paging");
      expect(toggleBtn).toHaveAttribute("role", "switch");
      expect(toggleBtn).toHaveAttribute("aria-checked", "false");
      expect(toggleBtn).toHaveAttribute("aria-pressed", "false");

      await user.click(toggleBtn);
      expect(onToggleVolumeKeyPaging).toHaveBeenCalledTimes(1);
    });

    it("enableVolumeKeyPaging=true のとき aria-pressed が true になること", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          enableVolumeKeyPaging={true}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      const toggleBtn = screen.getByTestId("toggle-volume-key-paging");
      expect(toggleBtn).toHaveAttribute("role", "switch");
      expect(toggleBtn).toHaveAttribute("aria-checked", "true");
      expect(toggleBtn).toHaveAttribute("aria-pressed", "true");
    });

    it("isLoading=true のときトグルボタンが無効化されること", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          isLoading={true}
          enableVolumeKeyPaging={false}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      expect(screen.getByTestId("toggle-volume-key-paging")).toBeDisabled();
    });
  });

  describe("バージョン表示フッター (AC-ST-20, v1.0 Issue #304)", () => {
    it("最下部に settings-version-footer がレンダリングされ、デフォルトで 'Yommy v1.0.0' が表示されること (AC-ST-20)", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      const footer = screen.getByTestId("settings-version-footer");
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent("Yommy v1.0.0");
      expect(footer).toHaveClass(
        "mt-8",
        "mb-6",
        "text-center",
        "text-xs",
        "text-slate-500",
        "dark:text-slate-400",
      );
    });

    it("appName および appVersion Props を指定した場合、渡された値でフッターが表示されること (AC-ST-20)", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          appName="CustomReader"
          appVersion="2.5.0"
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      const footer = screen.getByTestId("settings-version-footer");
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent("CustomReader v2.5.0");
    });

    it("isUpdating=true のとき、組み方向切替ボタンと音量キートグルスイッチが無効化されること (R1-35)", () => {
      render(
        <SettingsPage
          writingMode="vertical-rl"
          theme="light"
          isUpdating={true}
          onToggleWritingMode={vi.fn()}
          onChangeTheme={vi.fn()}
          onChangeFontSize={vi.fn()}
          onChangeLineHeight={vi.fn()}
        />,
      );

      const orientationBtn = screen.getByTestId("toggle-orientation");
      expect(orientationBtn).toBeDisabled();

      const volumeKeySwitch = screen.getByTestId("toggle-volume-key-paging");
      expect(volumeKeySwitch).toBeDisabled();
    });
  });
});
