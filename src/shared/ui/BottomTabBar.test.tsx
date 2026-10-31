import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./BottomTabBar.stories";
import { BottomTabBar } from "./BottomTabBar";

const { BookshelfActive, SearchActive, RankingActive, SettingsActive } =
  composeStories(stories);

describe("BottomTabBar", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("BookshelfActive ストーリーで本棚タブがアクティブとなり、アクセシビリティ属性およびラベルが正しく設定されること", () => {
      render(<BookshelfActive />);

      const nav = screen.getByTestId("bottom-tab-bar");
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute("role", "tablist");
      expect(nav).toHaveAttribute("aria-label", "メインナビゲーション");

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      const searchTab = screen.getByTestId("tab-search");
      const rankingTab = screen.getByTestId("tab-ranking");
      const settingsTab = screen.getByTestId("tab-settings");

      expect(bookshelfTab).toBeInTheDocument();
      expect(bookshelfTab).toHaveAttribute("role", "tab");
      expect(bookshelfTab).toHaveAttribute("aria-selected", "true");
      expect(bookshelfTab).toHaveTextContent("本棚");

      expect(searchTab).toBeInTheDocument();
      expect(searchTab).toHaveAttribute("role", "tab");
      expect(searchTab).toHaveAttribute("aria-selected", "false");
      expect(searchTab).toHaveTextContent("検索");

      expect(rankingTab).toBeInTheDocument();
      expect(rankingTab).toHaveAttribute("role", "tab");
      expect(rankingTab).toHaveAttribute("aria-selected", "false");
      expect(rankingTab).toHaveTextContent("ランキング");

      expect(settingsTab).toBeInTheDocument();
      expect(settingsTab).toHaveAttribute("role", "tab");
      expect(settingsTab).toHaveAttribute("aria-selected", "false");
      expect(settingsTab).toHaveTextContent("設定");
    });

    it("SearchActive ストーリーで検索タブがアクティブとなり、アクセシビリティ属性およびラベルが正しく設定されること", () => {
      render(<SearchActive />);

      const searchTab = screen.getByTestId("tab-search");
      expect(searchTab).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-ranking")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-settings")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("RankingActive ストーリーでランキングタブがアクティブとなり、アクセシビリティ属性およびラベルが正しく設定されること", () => {
      render(<RankingActive />);

      const rankingTab = screen.getByTestId("tab-ranking");
      expect(rankingTab).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-search")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-settings")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });

    it("SettingsActive ストーリーで設定タブがアクティブとなり、アクセシビリティ属性およびラベルが正しく設定されること", () => {
      render(<SettingsActive />);

      const settingsTab = screen.getByTestId("tab-settings");
      expect(settingsTab).toHaveAttribute("aria-selected", "true");
      expect(screen.getByTestId("tab-bookshelf")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-search")).toHaveAttribute(
        "aria-selected",
        "false",
      );
      expect(screen.getByTestId("tab-ranking")).toHaveAttribute(
        "aria-selected",
        "false",
      );
    });
  });

  describe("ユーザー操作とコールバック検証", () => {
    it("本棚タブをクリックしたときに onSelectBookshelf コールバックが呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectBookshelf = vi.fn();
      const onSelectSearch = vi.fn();
      const onSelectRanking = vi.fn();
      const onSelectSettings = vi.fn();

      render(
        <BottomTabBar
          activeTab="settings"
          onSelectBookshelf={onSelectBookshelf}
          onSelectSearch={onSelectSearch}
          onSelectRanking={onSelectRanking}
          onSelectSettings={onSelectSettings}
        />,
      );

      const bookshelfTab = screen.getByTestId("tab-bookshelf");
      await user.click(bookshelfTab);

      expect(onSelectBookshelf).toHaveBeenCalledTimes(1);
      expect(onSelectSearch).not.toHaveBeenCalled();
      expect(onSelectRanking).not.toHaveBeenCalled();
      expect(onSelectSettings).not.toHaveBeenCalled();
    });

    it("検索タブをクリックしたときに onSelectSearch コールバックが呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectBookshelf = vi.fn();
      const onSelectSearch = vi.fn();
      const onSelectRanking = vi.fn();
      const onSelectSettings = vi.fn();

      render(
        <BottomTabBar
          activeTab="bookshelf"
          onSelectBookshelf={onSelectBookshelf}
          onSelectSearch={onSelectSearch}
          onSelectRanking={onSelectRanking}
          onSelectSettings={onSelectSettings}
        />,
      );

      const searchTab = screen.getByTestId("tab-search");
      await user.click(searchTab);

      expect(onSelectSearch).toHaveBeenCalledTimes(1);
      expect(onSelectBookshelf).not.toHaveBeenCalled();
      expect(onSelectRanking).not.toHaveBeenCalled();
      expect(onSelectSettings).not.toHaveBeenCalled();
    });

    it("ランキングタブをクリックしたときに onSelectRanking コールバックが呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectBookshelf = vi.fn();
      const onSelectSearch = vi.fn();
      const onSelectRanking = vi.fn();
      const onSelectSettings = vi.fn();

      render(
        <BottomTabBar
          activeTab="bookshelf"
          onSelectBookshelf={onSelectBookshelf}
          onSelectSearch={onSelectSearch}
          onSelectRanking={onSelectRanking}
          onSelectSettings={onSelectSettings}
        />,
      );

      const rankingTab = screen.getByTestId("tab-ranking");
      await user.click(rankingTab);

      expect(onSelectRanking).toHaveBeenCalledTimes(1);
      expect(onSelectBookshelf).not.toHaveBeenCalled();
      expect(onSelectSearch).not.toHaveBeenCalled();
      expect(onSelectSettings).not.toHaveBeenCalled();
    });

    it("設定タブをクリックしたときに onSelectSettings コールバックが呼び出されること", async () => {
      const user = userEvent.setup();
      const onSelectBookshelf = vi.fn();
      const onSelectSearch = vi.fn();
      const onSelectRanking = vi.fn();
      const onSelectSettings = vi.fn();

      render(
        <BottomTabBar
          activeTab="bookshelf"
          onSelectBookshelf={onSelectBookshelf}
          onSelectSearch={onSelectSearch}
          onSelectRanking={onSelectRanking}
          onSelectSettings={onSelectSettings}
        />,
      );

      const settingsTab = screen.getByTestId("tab-settings");
      await user.click(settingsTab);

      expect(onSelectSettings).toHaveBeenCalledTimes(1);
      expect(onSelectBookshelf).not.toHaveBeenCalled();
      expect(onSelectSearch).not.toHaveBeenCalled();
      expect(onSelectRanking).not.toHaveBeenCalled();
    });
  });

  describe("スタイルと className の適用検証", () => {
    it("カスタム className が指定された場合、ルート要素に正しく付与されること", () => {
      render(
        <BottomTabBar
          activeTab="bookshelf"
          onSelectBookshelf={vi.fn()}
          onSelectSettings={vi.fn()}
          className="custom-tab-class"
        />,
      );

      const nav = screen.getByTestId("bottom-tab-bar");
      expect(nav).toHaveClass("custom-tab-class");
    });

    it("className が未指定の場合でも基本クラスが付与されること", () => {
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
      expect(nav).toHaveClass("grid-cols-4");
    });

    it("各タブボタンがスマホ幅での改行を防止するスタイル（whitespace-nowrap, flex-col sm:flex-row）を持つこと", () => {
      render(
        <BottomTabBar
          activeTab="bookshelf"
          onSelectBookshelf={vi.fn()}
          onSelectSettings={vi.fn()}
        />,
      );

      const tabIds = [
        "tab-bookshelf",
        "tab-search",
        "tab-ranking",
        "tab-settings",
      ];

      for (const tabId of tabIds) {
        const tab = screen.getByTestId(tabId);
        expect(tab).toHaveClass("whitespace-nowrap");
        expect(tab).toHaveClass("flex-col");
        expect(tab).toHaveClass("sm:flex-row");
      }
    });
  });
});
