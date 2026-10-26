import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./EpisodeListItem.stories";
import { EpisodeListItem } from "./EpisodeListItem";
import type { ChapterSummary } from "../../../storage/types";

const { Uncached, Cached, ReadAndCached, Bookmarked, WithoutDate } =
  composeStories(stories);

const baseChapter: ChapterSummary = {
  id: "chapter-1",
  novelId: "novel-1",
  chapterIndex: 1,
  remoteChapterId: "1",
  partTitle: "第一部",
  title: "プロローグ",
  url: "https://kakuyomu.jp/works/1/episodes/1",
  byteSize: 0,
  isRead: false,
  publishedAt: "2026-01-01T10:00:00Z",
  downloadedAt: null,
};

describe("EpisodeListItem", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Uncached ストーリーで未取得・未読バッジおよびタイトル・日時が表示されること (AC-ND-02)", () => {
      render(<Uncached />);
      const item = screen.getByTestId("episode-item");
      expect(item).toBeInTheDocument();
      expect(item).toHaveAttribute("data-chapter-index", "1");

      const title = screen.getByTestId("episode-item-title");
      expect(title).toHaveTextContent("第1話 プロローグ");

      const date = screen.getByTestId("episode-item-date");
      expect(date).toHaveTextContent("2026/01/01");

      expect(screen.getByTestId("episode-uncached-badge")).toHaveTextContent(
        "未取得",
      );
      expect(
        screen.queryByTestId("episode-cached-badge"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("episode-read-badge"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("episode-bookmark-badge"),
      ).not.toBeInTheDocument();
    });

    it("Cached ストーリーで取得済みバッジが表示されること (AC-ND-02)", () => {
      render(<Cached />);
      expect(screen.getByTestId("episode-cached-badge")).toHaveTextContent(
        "取得済み",
      );
      expect(
        screen.queryByTestId("episode-uncached-badge"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("episode-read-badge"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("episode-bookmark-badge"),
      ).not.toBeInTheDocument();
    });

    it("ReadAndCached ストーリーで取得済みバッジおよび既読バッジが表示されること (AC-ND-02)", () => {
      render(<ReadAndCached />);
      expect(screen.getByTestId("episode-cached-badge")).toHaveTextContent(
        "取得済み",
      );
      expect(screen.getByTestId("episode-read-badge")).toHaveTextContent(
        "既読",
      );
      expect(
        screen.queryByTestId("episode-uncached-badge"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("episode-bookmark-badge"),
      ).not.toBeInTheDocument();
    });

    it("Bookmarked ストーリーでしおりバッジが表示されること (AC-ND-02)", () => {
      render(<Bookmarked />);
      expect(screen.getByTestId("episode-bookmark-badge")).toHaveTextContent(
        "しおり",
      );
      expect(screen.getByTestId("episode-cached-badge")).toHaveTextContent(
        "取得済み",
      );
      expect(screen.getByTestId("episode-read-badge")).toHaveTextContent(
        "既読",
      );
    });

    it("WithoutDate ストーリーで公開日時要素が描画されないこと (AC-ND-02)", () => {
      render(<WithoutDate />);
      expect(screen.queryByTestId("episode-item-date")).not.toBeInTheDocument();
      expect(screen.getByTestId("episode-item-title")).toHaveTextContent(
        "第1話 プロローグ",
      );
    });
  });

  describe("ユーザーインタラクションとキャッシュ判定の検証", () => {
    it("エピソード行をクリックすると onSelectEpisode が該当話数で呼び出されること (AC-ND-04)", async () => {
      const user = userEvent.setup();
      const onSelectEpisode = vi.fn();

      render(
        <EpisodeListItem
          chapter={baseChapter}
          isBookmarked={false}
          onSelectEpisode={onSelectEpisode}
        />,
      );

      const item = screen.getByTestId("episode-item");
      await user.click(item);
      expect(onSelectEpisode).toHaveBeenCalledTimes(1);
      expect(onSelectEpisode).toHaveBeenCalledWith(1);
    });

    it("downloadedAt が null でも byteSize > 0 の場合は取得済みバッジが表示されること", () => {
      const chapterWithByteSize: ChapterSummary = {
        ...baseChapter,
        downloadedAt: null,
        byteSize: 512,
      };

      render(
        <EpisodeListItem
          chapter={chapterWithByteSize}
          isBookmarked={false}
          onSelectEpisode={vi.fn()}
        />,
      );

      expect(screen.getByTestId("episode-cached-badge")).toBeInTheDocument();
      expect(
        screen.queryByTestId("episode-uncached-badge"),
      ).not.toBeInTheDocument();
    });

    it("publishedAt が T を含まない日付文字列の場合もフォーマットして表示されること", () => {
      const chapterWithRawDate: ChapterSummary = {
        ...baseChapter,
        publishedAt: "2026-03-01",
      };

      render(
        <EpisodeListItem
          chapter={chapterWithRawDate}
          isBookmarked={false}
          onSelectEpisode={vi.fn()}
        />,
      );

      expect(screen.getByTestId("episode-item-date")).toHaveTextContent(
        "2026/03/01",
      );
    });
  });
});
