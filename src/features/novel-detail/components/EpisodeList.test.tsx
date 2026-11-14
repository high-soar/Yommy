import { render, screen } from "@testing-library/react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { composeStories } from "@storybook/react";
import * as stories from "./EpisodeList.stories";
import { EpisodeList } from "./EpisodeList";
import * as EpisodeListItemModule from "./EpisodeListItem";
import type { ChapterSummary } from "../../../storage/types";

const { Default, Empty, WithoutPartTitle, WithFailedChapters } =
  composeStories(stories);

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Storybook Stories 検証 (composeStories)", () => {
    it("Empty ストーリーで空状態メッセージが表示され EpisodeListItem は描画されないこと (AC-ND-02)", () => {
      const itemSpy = vi
        .spyOn(EpisodeListItemModule, "EpisodeListItem")
        .mockImplementation(() => null);
      try {
        render(<Empty />);
        const emptyElement = screen.getByTestId("episode-list-empty");
        expect(emptyElement).toBeInTheDocument();
        expect(emptyElement).toHaveTextContent("エピソード目次がありません。");
        expect(screen.queryByTestId("episode-list")).not.toBeInTheDocument();
        expect(itemSpy).not.toHaveBeenCalled();
      } finally {
        itemSpy.mockRestore();
      }
    });

    it("Default ストーリーで章見出しが描画され全エピソード行の props が EpisodeListItem へ渡されること (AC-ND-02)", () => {
      const itemSpy = vi
        .spyOn(EpisodeListItemModule, "EpisodeListItem")
        .mockImplementation(() => null);
      try {
        render(<Default />);
        expect(screen.getByTestId("episode-list")).toBeInTheDocument();
        expect(
          screen.queryByTestId("episode-list-empty"),
        ).not.toBeInTheDocument();

        const headers = screen.getAllByTestId("chapter-section-header");
        expect(headers).toHaveLength(2);
        expect(headers[0]).toHaveTextContent("第一部 始まりの街");
        expect(headers[1]).toHaveTextContent("第二部 荒野を越えて");

        expect(itemSpy).toHaveBeenCalledTimes(3);
        expect(itemSpy.mock.calls[0][0]).toEqual(
          expect.objectContaining({
            chapter: expect.objectContaining({
              chapterIndex: 1,
              title: "プロローグ",
            }),
            isBookmarked: false,
          }),
        );
        expect(itemSpy.mock.calls[1][0]).toEqual(
          expect.objectContaining({
            chapter: expect.objectContaining({
              chapterIndex: 2,
              title: "旅立ちの朝",
            }),
            isBookmarked: true,
          }),
        );
        expect(itemSpy.mock.calls[2][0]).toEqual(
          expect.objectContaining({
            chapter: expect.objectContaining({
              chapterIndex: 3,
              title: "盗賊との遭遇",
            }),
            isBookmarked: false,
          }),
        );
      } finally {
        itemSpy.mockRestore();
      }
    });

    it("WithoutPartTitle ストーリーで章見出しが挿入されずに EpisodeListItem のみが呼び出されること (AC-ND-02)", () => {
      const itemSpy = vi
        .spyOn(EpisodeListItemModule, "EpisodeListItem")
        .mockImplementation(() => null);
      try {
        render(<WithoutPartTitle />);
        expect(screen.getByTestId("episode-list")).toBeInTheDocument();
        expect(
          screen.queryByTestId("chapter-section-header"),
        ).not.toBeInTheDocument();

        expect(itemSpy).toHaveBeenCalledTimes(2);
      } finally {
        itemSpy.mockRestore();
      }
    });

    it("WithFailedChapters ストーリーで取得失敗話に isDownloadFailed=true が伝達されること (AC-ND-25)", () => {
      const itemSpy = vi
        .spyOn(EpisodeListItemModule, "EpisodeListItem")
        .mockImplementation(() => null);
      try {
        render(<WithFailedChapters />);
        expect(screen.getByTestId("episode-list")).toBeInTheDocument();

        expect(itemSpy).toHaveBeenCalledTimes(3);
        expect(itemSpy.mock.calls[0][0].isDownloadFailed).toBe(false);
        expect(itemSpy.mock.calls[1][0].isDownloadFailed).toBe(false);
        expect(itemSpy.mock.calls[2][0].chapter.chapterIndex).toBe(3);
        expect(itemSpy.mock.calls[2][0].isDownloadFailed).toBe(true);
      } finally {
        itemSpy.mockRestore();
      }
    });
  });

  describe("章見出し境界判定および親子イベント・プロパティ連携の検証", () => {
    it("partTitle の変化境界でのみ章見出しが挿入され、null や空文字では見出しが出ないこと (AC-ND-02)", () => {
      const itemSpy = vi
        .spyOn(EpisodeListItemModule, "EpisodeListItem")
        .mockImplementation(() => null);
      try {
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

        expect(itemSpy).toHaveBeenCalledTimes(4);
      } finally {
        itemSpy.mockRestore();
      }
    });

    it("親子分離: EpisodeListItem へ onSelectEpisode が伝達され、コールバック呼び出し時に指定話数で発火すること (AC-ND-04)", () => {
      const itemSpy = vi
        .spyOn(EpisodeListItemModule, "EpisodeListItem")
        .mockImplementation(() => null);
      try {
        const onSelectEpisode = vi.fn();

        render(
          <EpisodeList
            chapters={testChapters}
            bookmarkChapterIndex={null}
            onSelectEpisode={onSelectEpisode}
          />,
        );

        expect(itemSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            chapter: testChapters[1],
            onSelectEpisode,
          }),
          undefined,
        );

        const passedProps = itemSpy.mock.calls[1][0];
        passedProps.onSelectEpisode(2);
        expect(onSelectEpisode).toHaveBeenCalledTimes(1);
        expect(onSelectEpisode).toHaveBeenCalledWith(2);
      } finally {
        itemSpy.mockRestore();
      }
    });

    it("親子分離: bookmarkChapterIndex と一致するエピソード行に isBookmarked: true が伝達されること", () => {
      const itemSpy = vi
        .spyOn(EpisodeListItemModule, "EpisodeListItem")
        .mockImplementation(() => null);
      try {
        render(
          <EpisodeList
            chapters={testChapters}
            bookmarkChapterIndex={2}
            onSelectEpisode={vi.fn()}
          />,
        );

        // 第1話: false, 第2話: true, 第3話: false, 第4話: false
        expect(itemSpy.mock.calls[0][0].isBookmarked).toBe(false);
        expect(itemSpy.mock.calls[1][0].isBookmarked).toBe(true);
        expect(itemSpy.mock.calls[2][0].isBookmarked).toBe(false);
        expect(itemSpy.mock.calls[3][0].isBookmarked).toBe(false);
      } finally {
        itemSpy.mockRestore();
      }
    });

    it("親子分離: failedChapterIndexes に含まれる話数に isDownloadFailed: true が伝達されること (AC-ND-25)", () => {
      const itemSpy = vi
        .spyOn(EpisodeListItemModule, "EpisodeListItem")
        .mockImplementation(() => null);
      try {
        const uncachedChapters: ChapterSummary[] = testChapters.map((c) => ({
          ...c,
          byteSize: 0,
          downloadedAt: null,
        }));

        render(
          <EpisodeList
            chapters={uncachedChapters}
            bookmarkChapterIndex={null}
            failedChapterIndexes={[1, 4]}
            onSelectEpisode={vi.fn()}
          />,
        );

        expect(itemSpy.mock.calls[0][0].isDownloadFailed).toBe(true);
        expect(itemSpy.mock.calls[1][0].isDownloadFailed).toBe(false);
        expect(itemSpy.mock.calls[2][0].isDownloadFailed).toBe(false);
        expect(itemSpy.mock.calls[3][0].isDownloadFailed).toBe(true);
      } finally {
        itemSpy.mockRestore();
      }
    });
  });
});
