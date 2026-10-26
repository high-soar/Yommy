import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { EpisodeListItem } from "./EpisodeListItem";
import type { ChapterSummary } from "../../../storage/types";

const sampleChapter: ChapterSummary = {
  id: "chapter-1",
  novelId: "novel-1",
  chapterIndex: 1,
  remoteChapterId: "1",
  partTitle: "第一部 始まりの章",
  title: "プロローグ",
  url: "https://kakuyomu.jp/works/16817330658027210412/episodes/1",
  byteSize: 0,
  isRead: false,
  publishedAt: "2026-01-01T10:00:00Z",
  downloadedAt: null,
};

const meta: Meta<typeof EpisodeListItem> = {
  title: "NovelDetail/EpisodeListItem",
  component: EpisodeListItem,
  args: {
    chapter: sampleChapter,
    isBookmarked: false,
    onSelectEpisode: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof EpisodeListItem>;

/**
 * 未取得・未読状態のエピソード行
 */
export const Uncached: Story = {
  name: "未取得・未読",
  args: {
    chapter: {
      ...sampleChapter,
      downloadedAt: null,
      byteSize: 0,
      isRead: false,
    },
    isBookmarked: false,
  },
};

/**
 * 取得済み・未読状態のエピソード行
 */
export const Cached: Story = {
  name: "取得済み・未読",
  args: {
    chapter: {
      ...sampleChapter,
      downloadedAt: "2026-01-01T12:00:00Z",
      byteSize: 1024,
      isRead: false,
    },
    isBookmarked: false,
  },
};

/**
 * 取得済み・既読状態のエピソード行
 */
export const ReadAndCached: Story = {
  name: "取得済み・既読",
  args: {
    chapter: {
      ...sampleChapter,
      downloadedAt: "2026-01-01T12:00:00Z",
      byteSize: 1024,
      isRead: true,
    },
    isBookmarked: false,
  },
};

/**
 * しおり位置のエピソード行（取得済み・既読・しおりあり）
 */
export const Bookmarked: Story = {
  name: "しおり位置（取得済み・既読・しおりあり）",
  args: {
    chapter: {
      ...sampleChapter,
      downloadedAt: "2026-01-01T12:00:00Z",
      byteSize: 1024,
      isRead: true,
    },
    isBookmarked: true,
  },
};

/**
 * 公開日時が設定されていないエピソード行
 */
export const WithoutDate: Story = {
  name: "公開日時なし",
  args: {
    chapter: {
      ...sampleChapter,
      publishedAt: null,
    },
    isBookmarked: false,
  },
};
