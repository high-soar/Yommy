import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BottomTabBar.stories";
import { BottomTabBar } from "./BottomTabBar";

const { BookshelfActive, SettingsActive } = composeStories(stories);

describe("BottomTabBar", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("BookshelfActive ストーリーで本棚タブがアクティブとなり、アクセシビリティ属性およびラベルが正しく設定されること", () => {
      render(<BookshelfActive />);

      const nav = screen.getByTestId("bottom-tab-bar");
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute("role", "tablist");
      expect(nav).toHaveAttribute("aria-label", "メインナビゲーション");

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      const settingsTab = screen.getByTestId("tab-settings");

      expect(bookshelfTab).toBeInTheDocument();
      expect(bookshelfTab).toHaveAttribute("role", "tab");
      expect(bookshelfTab).toHaveAttribute("aria-selected", "true");
      expect(bookshelfTab).toHaveTextContent("本棚");

      expect(settingsTab).toBeInTheDocument();
      expect(settingsTab).toHaveAttribute("role", "tab");
      expect(settingsTab).toHaveAttribute("aria-selected", "false");
      expect(settingsTab).toHaveTextContent("設定");
    });

    it("SettingsActive ストーリーで設定タブがアクティブとなり、アクセシビリティ属性およびラベルが正しく設定されること", () => {
      render(<SettingsActive />);

      const nav = screen.getByTestId("bottom-tab-bar");
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute("role", "tablist");
      expect(nav).toHaveAttribute("aria-label", "メインナビゲーション");

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      const settingsTab = screen.getByTestId("tab-settings");

      expect(bookshelfTab).toBeInTheDocument();
      expect(bookshelfTab).toHaveAttribute("role", "tab");
      expect(bookshelfTab).toHaveAttribute("aria-selected", "false");

      expect(settingsTab).toBeInTheDocument();
      expect(settingsTab).toHaveAttribute("role", "tab");
      expect(settingsTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("ユーザー操作とコールバック検証", () => {
    it("本棚タブをクリックしたときに onSelectBookshelf コールバックが呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectBookshelf = vi.fn();
      const onSelectSettings = vi.fn();

      render(
        <BottomTabBar
          activeTab="settings"
          onSelectBookshelf={onSelectBookshelf}
          onSelectSettings={onSelectSettings}
        />,
      );

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      await user.click(bookshelfTab);

      expect(onSelectBookshelf).toHaveBeenCalledTimes(1);
      expect(onSelectSettings).not.toHaveBeenCalled();
    });

    it("設定タブをクリックしたときに onSelectSettings コールバックが呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectBookshelf = vi.fn();
      const onSelectSettings = vi.fn();

      render(
        <BottomTabBar
          activeTab="bookshelf"
          onSelectBookshelf={onSelectBookshelf}
          onSelectSettings={onSelectSettings}
        />,
      );

      const settingsTab = screen.getByTestId("tab-settings");
      await user.click(settingsTab);

      expect(onSelectSettings).toHaveBeenCalledTimes(1);
      expect(onSelectBookshelf).not.toHaveBeenCalled();
    });
  });

  describe("スタイルと className の適用検証", () => {
    it("カスタム className が指定された場合、ルート要素に正しく付与されること", () => {
      render(
        <BottomTabBar
          activeTab="bookshelf"
          onSelectBookshelf={vi.fn()}
          onSelectSettings={vi.fn()}
          className="custom-class"
        />,
      );

      const nav = screen.getByTestId("bottom-tab-bar");
      expect(nav).toHaveClass("custom-class");
      expect(nav).toHaveClass("h-14");
    });

    it("className が省略された場合でもデフォルトスタイルが正しく適用されること", () => {
      render(
        <BottomTabBar
          activeTab="bookshelf"
          onSelectBookshelf={vi.fn()}
          onSelectSettings={vi.fn()}
        />,
      );

      const nav = screen.getByTestId("bottom-tab-bar");
      expect(nav).toHaveClass("h-14");
      expect(nav).toHaveClass("border-t");
    });

    it("アクティブおよび非アクティブタブに適切なスタイルクラスが適用されること", () => {
      const { rerender } = render(
        <BottomTabBar
          activeTab="bookshelf"
          onSelectBookshelf={vi.fn()}
          onSelectSettings={vi.fn()}
        />,
      );

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      const settingsTab = screen.getByTestId("tab-settings");

      expect(bookshelfTab).toHaveClass("text-emerald-700");
      expect(settingsTab).toHaveClass("text-slate-600");

      rerender(
        <BottomTabBar
          activeTab="settings"
          onSelectBookshelf={vi.fn()}
          onSelectSettings={vi.fn()}
        />,
      );

      expect(bookshelfTab).toHaveClass("text-slate-600");
      expect(settingsTab).toHaveClass("text-emerald-700");
    });
  });
});
