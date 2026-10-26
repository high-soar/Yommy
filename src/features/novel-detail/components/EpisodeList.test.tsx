import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./EpisodeList.stories";
import { EpisodeList } from "./EpisodeList";
import type { ChapterSummary } from "../../../storage/types";

const { Default, Empty, WithoutPartTitle } = composeStories(stories);

const testChapters: ChapterSummary[] = [
  {
    id: "chapter-1",
    novelId: "novel-1",
    chapterIndex: 1,
    remoteChapterId: "1",
    partTitle: "第一部",
    title: "第1話",
    url: "https://kakuyomu.jp/works/1/episodes/1",
    byteSize: 100,
    isRead: false,
    publishedAt: "2026-01-01",
    downloadedAt: null,
  },
  {
    id: "chapter-2",
    novelId: "novel-1",
    chapterIndex: 2,
    remoteChapterId: "2",
    partTitle: "第一部",
    title: "第2話",
    url: "https://kakuyomu.jp/works/1/episodes/2",
    byteSize: 100,
    isRead: false,
    publishedAt: "2026-01-02",
    downloadedAt: null,
  },
  {
    id: "chapter-3",
    novelId: "novel-1",
    chapterIndex: 3,
    remoteChapterId: "3",
    partTitle: null,
    title: "幕間",
    url: "https://kakuyomu.jp/works/1/episodes/3",
    byteSize: 100,
    isRead: false,
    publishedAt: "2026-01-03",
    downloadedAt: null,
  },
  {
    id: "chapter-4",
    novelId: "novel-1",
    chapterIndex: 4,
    remoteChapterId: "4",
    partTitle: "第二部",
    title: "第3話",
    url: "https://kakuyomu.jp/works/1/episodes/4",
    byteSize: 100,
    isRead: false,
    publishedAt: "2026-01-04",
    downloadedAt: null,
  },
];

describe("EpisodeList", () => {
  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Empty ストーリーで空状態メッセージが表示されること (AC-ND-02)", () => {
      render(<Empty />);
      const emptyElement = screen.getByTestId("episode-list-empty");
      expect(emptyElement).toBeInTheDocument();
      expect(emptyElement).toHaveTextContent("エピソード目次がありません。");
      expect(screen.queryByTestId("episode-list")).not.toBeInTheDocument();
    });

    it("Default ストーリーで章見出しと全エピソード行が表示されること (AC-ND-02)", () => {
      render(<Default />);
      expect(screen.getByTestId("episode-list")).toBeInTheDocument();
      expect(
        screen.queryByTestId("episode-list-empty"),
      ).not.toBeInTheDocument();

      const headers = screen.getAllByTestId("chapter-section-header");
      expect(headers).toHaveLength(2);
      expect(headers[0]).toHaveTextContent("第一部 始まりの街");
      expect(headers[1]).toHaveTextContent("第二部 荒野を越えて");

      const items = screen.getAllByTestId("episode-item");
      expect(items).toHaveLength(3);
    });

    it("WithoutPartTitle ストーリーで章見出しが挿入されずにエピソード行のみ描画されること (AC-ND-02)", () => {
      render(<WithoutPartTitle />);
      expect(screen.getByTestId("episode-list")).toBeInTheDocument();
      expect(
        screen.queryByTestId("chapter-section-header"),
      ).not.toBeInTheDocument();

      const items = screen.getAllByTestId("episode-item");
      expect(items).toHaveLength(2);
    });
  });

  describe("章見出し境界判定および親子イベント・プロパティ連携の検証", () => {
    it("partTitle の変化境界でのみ章見出しが挿入され、null や空文字では見出しが出ないこと (AC-ND-02)", () => {
      render(
        <EpisodeList
          chapters={testChapters}
          bookmarkChapterIndex={null}
          onSelectEpisode={vi.fn()}
        />,
      );

      const headers = screen.getAllByTestId("chapter-section-header");
      expect(headers).toHaveLength(2);
      expect(headers[0]).toHaveTextContent("第一部");
      expect(headers[1]).toHaveTextContent("第二部");

      const items = screen.getAllByTestId("episode-item");
      expect(items).toHaveLength(4);
    });

    it("エピソード行をクリックすると onSelectEpisode が選択された話数で呼び出されること (AC-ND-04)", async () => {
      const user = userEvent.setup();
      const onSelectEpisode = vi.fn();

      render(
        <EpisodeList
          chapters={testChapters}
          bookmarkChapterIndex={null}
          onSelectEpisode={onSelectEpisode}
        />,
      );

      const items = screen.getAllByTestId("episode-item");
      await user.click(items[1]); // chapterIndex: 2
      expect(onSelectEpisode).toHaveBeenCalledTimes(1);
      expect(onSelectEpisode).toHaveBeenCalledWith(2);
    });

    it("bookmarkChapterIndex と一致するエピソード行にしおり状態が伝達されること", () => {
      render(
        <EpisodeList
          chapters={testChapters}
          bookmarkChapterIndex={2}
          onSelectEpisode={vi.fn()}
        />,
      );

      // 第2話にしおりバッジが存在し、第1話・第3話・第4話には存在しないこと
      const bookmarkBadges = screen.getAllByTestId("episode-bookmark-badge");
      expect(bookmarkBadges).toHaveLength(1);
      expect(
        bookmarkBadges[0].closest("[data-chapter-index='2']"),
      ).not.toBeNull();
    });
  });
});
