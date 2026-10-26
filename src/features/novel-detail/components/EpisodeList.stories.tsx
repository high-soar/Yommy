import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { EpisodeList } from "./EpisodeList";
import type { ChapterSummary } from "../../../storage/types";

const sampleChapters: ChapterSummary[] = [
  {
    id: "chapter-1",
    novelId: "novel-1",
    chapterIndex: 1,
    remoteChapterId: "1",
    partTitle: "第一部 始まりの街",
    title: "プロローグ",
    url: "https://kakuyomu.jp/works/1/episodes/1",
    byteSize: 1024,
    isRead: true,
    publishedAt: "2026-01-01T10:00:00Z",
    downloadedAt: "2026-01-01T12:00:00Z",
  },
  {
    id: "chapter-2",
    novelId: "novel-1",
    chapterIndex: 2,
    remoteChapterId: "2",
    partTitle: "第一部 始まりの街",
    title: "旅立ちの朝",
    url: "https://kakuyomu.jp/works/1/episodes/2",
    byteSize: 2048,
    isRead: true,
    publishedAt: "2026-01-02T10:00:00Z",
    downloadedAt: "2026-01-02T12:00:00Z",
  },
  {
    id: "chapter-3",
    novelId: "novel-1",
    chapterIndex: 3,
    remoteChapterId: "3",
    partTitle: "第二部 荒野を越えて",
    title: "盗賊との遭遇",
    url: "https://kakuyomu.jp/works/1/episodes/3",
    byteSize: 0,
    isRead: false,
    publishedAt: "2026-01-03T10:00:00Z",
    downloadedAt: null,
  },
];

const meta: Meta<typeof EpisodeList> = {
  title: "NovelDetail/EpisodeList",
  component: EpisodeList,
  args: {
    chapters: sampleChapters,
    bookmarkChapterIndex: 2,
    onSelectEpisode: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof EpisodeList>;

/**
 * デフォルト表示（章見出し付き複数エピソード、しおり設定あり）
 */
export const Default: Story = {
  name: "デフォルト（章見出し・しおり付き）",
};

/**
 * エピソード0件の空状態
 */
export const Empty: Story = {
  name: "空状態（エピソード0件）",
  args: {
    chapters: [],
    bookmarkChapterIndex: null,
  },
};

/**
 * 章見出しが存在しない作品（短編・未分類）
 */
export const WithoutPartTitle: Story = {
  name: "章見出しなし作品（短編・未分類）",
  args: {
    chapters: [
      {
        ...sampleChapters[0],
        partTitle: null,
      },
      {
        ...sampleChapters[1],
        partTitle: "",
      },
    ],
    bookmarkChapterIndex: null,
  },
};
