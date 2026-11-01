import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./StorageCacheSection.stories";
import { StorageCacheSection } from "./StorageCacheSection";

const { Default, Empty, Loading, Clearing, WithNotice, WithError, DialogOpen } =
  composeStories(stories);

describe("StorageCacheSection", () => {
  describe("Storybook Stories 描画検証 (composeStories)", () => {
    it("Default: キャッシュ保持状態で合計話数・容量が表示され、整理ボタンが活性であること (AC-ST-14, AC-ST-15)", () => {
      render(<Default />);

      expect(screen.getByTestId("storage-cache-section")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: /ストレージ・キャッシュ管理/,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "ダウンロードした本文キャッシュの容量を確認し、安全に整理します。目次・既読・しおりは保持されます。",
        ),
      ).toBeInTheDocument();

      const summaryEl = screen.getByTestId("storage-cache-summary");
      expect(summaryEl).toHaveTextContent(
        "キャッシュ済み: 全 24 話（合計 3.2 MB）",
      );

      const openBtn = screen.getByTestId(
        "open-global-clear-cache-dialog-button",
      );
      expect(openBtn).toHaveTextContent("本文キャッシュを一括整理");
      expect(openBtn).toBeEnabled();

      expect(
        screen.queryByTestId("global-clear-cache-dialog"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("storage-cache-notice"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("storage-cache-error-alert"),
      ).not.toBeInTheDocument();
    });

    it("Empty: キャッシュ0件のときは容量 0 B が表示され、整理ボタンが disabled であること (AC-ST-14, AC-ST-15)", () => {
      render(<Empty />);

      const summaryEl = screen.getByTestId("storage-cache-summary");
      expect(summaryEl).toHaveTextContent(
        "キャッシュ済み: 全 0 話（合計 0 B）",
      );

      const openBtn = screen.getByTestId(
        "open-global-clear-cache-dialog-button",
      );
      expect(openBtn).toBeDisabled();
    });

    it("Loading: 集計情報読込中時は整理ボタンが disabled であること", () => {
      render(<Loading />);

      const openBtn = screen.getByTestId(
        "open-global-clear-cache-dialog-button",
      );
      expect(openBtn).toBeDisabled();
    });

    it("Clearing: 削除処理中時は整理ボタンが disabled であること", () => {
      render(<Clearing />);

      const openBtn = screen.getByTestId(
        "open-global-clear-cache-dialog-button",
      );
      expect(openBtn).toBeDisabled();
    });

    it("WithNotice: 完了通知枠が表示されること (AC-ST-16)", () => {
      render(<WithNotice />);

      const noticeEl = screen.getByTestId("storage-cache-notice");
      expect(noticeEl).toBeInTheDocument();
      expect(noticeEl).toHaveTextContent(
        "本文キャッシュを一括削除しました（24話）",
      );
    });

    it("WithError: エラー警告枠が role='alert' で表示されること", () => {
      render(<WithError />);

      const errorEl = screen.getByTestId("storage-cache-error-alert");
      expect(errorEl).toBeInTheDocument();
      expect(errorEl).toHaveAttribute("role", "alert");
      expect(errorEl).toHaveTextContent(
        "キャッシュの削除処理に失敗しました。時間をおいて再試行してください。",
      );
    });

    it("DialogOpen: 一括削除確認ダイアログが表示されること (AC-ST-15)", () => {
      render(<DialogOpen />);

      const dialog = screen.getByTestId("global-clear-cache-dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute("role", "dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");

      expect(
        screen.getByTestId("confirm-global-clear-read-cache-button"),
      ).toHaveTextContent("既読話の本文キャッシュのみ削除");
      expect(
        screen.getByTestId("confirm-global-clear-all-cache-button"),
      ).toHaveTextContent("すべての本文キャッシュを削除");
      expect(
        screen.getByTestId("cancel-global-clear-cache-button"),
      ).toHaveTextContent("キャンセル");
    });
  });

  describe("ユーザーインタラクションとエッジケース検証", () => {
    it("整理ボタン押下でダイアログが開き、既読削除ボタン押下で onClearCache({ onlyRead: true }) が呼ばれダイアログが閉じること (AC-ST-15)", async () => {
      const onClearCache = vi.fn();
      const user = userEvent.setup();

      render(
        <StorageCacheSection
          summary={{ totalCachedChapters: 10, totalByteSize: 102400 }}
          onClearCache={onClearCache}
        />,
      );

      const openBtn = screen.getByTestId(
        "open-global-clear-cache-dialog-button",
      );
      await user.click(openBtn);

      expect(
        screen.getByTestId("global-clear-cache-dialog"),
      ).toBeInTheDocument();

      const readBtn = screen.getByTestId(
        "confirm-global-clear-read-cache-button",
      );
      await user.click(readBtn);

      expect(onClearCache).toHaveBeenCalledWith({ onlyRead: true });
      expect(
        screen.queryByTestId("global-clear-cache-dialog"),
      ).not.toBeInTheDocument();
    });

    it("ダイアログで全削除ボタン押下時に onClearCache({ onlyRead: false }) が呼ばれダイアログが閉じること (AC-ST-15)", async () => {
      const onClearCache = vi.fn();
      const user = userEvent.setup();

      render(
        <StorageCacheSection
          summary={{ totalCachedChapters: 10, totalByteSize: 102400 }}
          onClearCache={onClearCache}
        />,
      );

      await user.click(
        screen.getByTestId("open-global-clear-cache-dialog-button"),
      );
      expect(
        screen.getByTestId("global-clear-cache-dialog"),
      ).toBeInTheDocument();

      await user.click(
        screen.getByTestId("confirm-global-clear-all-cache-button"),
      );

      expect(onClearCache).toHaveBeenCalledWith({ onlyRead: false });
      expect(
        screen.queryByTestId("global-clear-cache-dialog"),
      ).not.toBeInTheDocument();
    });

    it("ダイアログでキャンセルボタン押下時にダイアログが閉じること (AC-ST-15)", async () => {
      const onClearCache = vi.fn();
      const user = userEvent.setup();

      render(
        <StorageCacheSection
          summary={{ totalCachedChapters: 10, totalByteSize: 102400 }}
          onClearCache={onClearCache}
        />,
      );

      await user.click(
        screen.getByTestId("open-global-clear-cache-dialog-button"),
      );
      expect(
        screen.getByTestId("global-clear-cache-dialog"),
      ).toBeInTheDocument();

      await user.click(screen.getByTestId("cancel-global-clear-cache-button"));

      expect(onClearCache).not.toHaveBeenCalled();
      expect(
        screen.queryByTestId("global-clear-cache-dialog"),
      ).not.toBeInTheDocument();
    });

    it("ダイアログ表示中に Escape キー押下でダイアログが閉じること", async () => {
      const user = userEvent.setup();

      render(
        <StorageCacheSection
          summary={{ totalCachedChapters: 10, totalByteSize: 102400 }}
        />,
      );

      await user.click(
        screen.getByTestId("open-global-clear-cache-dialog-button"),
      );
      expect(
        screen.getByTestId("global-clear-cache-dialog"),
      ).toBeInTheDocument();

      await user.keyboard("{Escape}");
      expect(
        screen.queryByTestId("global-clear-cache-dialog"),
      ).not.toBeInTheDocument();
    });

    it("ダイアログ表示中に isClearing が true のときはダイアログの各ボタンが disabled になること", () => {
      render(
        <StorageCacheSection
          summary={{ totalCachedChapters: 10, totalByteSize: 102400 }}
          initialShowDialog={true}
          isClearing={true}
        />,
      );

      expect(
        screen.getByTestId("confirm-global-clear-read-cache-button"),
      ).toBeDisabled();
      expect(
        screen.getByTestId("confirm-global-clear-all-cache-button"),
      ).toBeDisabled();
      expect(
        screen.getByTestId("cancel-global-clear-cache-button"),
      ).toBeDisabled();
    });

    it("onClearCache が未定義の場合でもボタン押下時にエラーにならずダイアログが閉じること", async () => {
      const user = userEvent.setup();

      render(
        <StorageCacheSection
          summary={{ totalCachedChapters: 10, totalByteSize: 102400 }}
          initialShowDialog={true}
        />,
      );

      await user.click(
        screen.getByTestId("confirm-global-clear-read-cache-button"),
      );
      expect(
        screen.queryByTestId("global-clear-cache-dialog"),
      ).not.toBeInTheDocument();
    });

    it("カスタム className がルート要素に適用されること", () => {
      render(
        <StorageCacheSection
          summary={{ totalCachedChapters: 0, totalByteSize: 0 }}
          className="custom-storage-class"
        />,
      );

      expect(screen.getByTestId("storage-cache-section")).toHaveClass(
        "custom-storage-class",
      );
    });
  });
});
