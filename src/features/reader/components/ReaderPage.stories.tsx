import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ReaderPage } from "./ReaderPage";
import type { NovelRecord, ChapterRecord } from "../../../storage/types";

const sampleNovel: NovelRecord = {
  id: "kakuyomu:16817330658027210412",
  siteType: "kakuyomu",
  remoteWorkId: "16817330658027210412",
  canonicalUrl: "https://kakuyomu.jp/works/16817330658027210412",
  title: "境界迷宮と異界の魔術師",
  author: "小野崎",
  synopsis: "異界から迷い込んだ青年が紡ぐファンタジー戦記。",
  totalChapters: 3,
  cachedChapters: 2,
  totalByteSize: 10240,
  bookmarkChapterIndex: 1,
  bookmarkScrollProgress: 0,
  isFavorite: false,
  lastCheckedAt: null,
  lastReadAt: null,
  createdAt: "2026-10-25T10:00:00Z",
  updatedAt: "2026-10-26T07:00:00Z",
};

const sampleChapter: ChapterRecord = {
  id: "kakuyomu:16817330658027210412:1",
  novelId: "kakuyomu:16817330658027210412",
  chapterIndex: 1,
  remoteChapterId: "1",
  partTitle: "第一部 旅立ち",
  title: "第1話 見知らぬ空",
  url: "https://kakuyomu.jp/works/16817330658027210412/episodes/1",
  bodyHtml: `
<p>青い空に、二つの<ruby><rb>太陽</rb><rp>(</rp><rt>たいよう</rt><rp>)</rp></ruby>が輝いていた。</p>
<p class="blank"><br /></p>
<p>少年にとって、それは<em class="bouten">信じがたい光景</em>であった。</p>
<p>「ここはどこなんだ……？」</p>
`,
  byteSize: 1024,
  isRead: true,
  publishedAt: "2026-01-01T10:00:00Z",
  downloadedAt: "2026-01-01T12:00:00Z",
};

const meta: Meta<typeof ReaderPage> = {
  title: "Reader/ReaderPage",
  component: ReaderPage,
  args: {
    novel: sampleNovel,
    chapter: sampleChapter,
    chapterIndex: 1,
    totalChapters: 3,
    writingMode: "vertical-rl",
    theme: "light",
    fontSizePx: 18,
    lineHeight: 1.8,
    initialScrollProgress: 0,
    isLoading: false,
    error: null,
    onPrevChapter: fn(),
    onNextChapter: fn(),
    onScrollProgressChange: fn(),
    onSelectTab: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof ReaderPage>;

/**
 * 通常表示（第1話・縦書き・白テーマ・オーバーレイ初期非表示）
 */
export const Default: Story = {
  name: "通常表示（第1話・縦書き・白テーマ）",
};

/**
 * 下部オーバーレイ展開時
 */
export const OverlayOpen: Story = {
  name: "下部オーバーレイ展開時",
  args: {
    initialOverlayOpen: true,
  },
};

/**
 * 横書き・セピアテーマ（第2話）
 */
export const HorizontalSepia: Story = {
  name: "横書き・セピアテーマ（第2話）",
  args: {
    chapterIndex: 2,
    chapter: {
      ...sampleChapter,
      chapterIndex: 2,
      title: "第2話 覚醒の兆し",
      bodyHtml: "<p>風が止み、森の静けさが深まる。</p>",
    },
    writingMode: "horizontal-tb",
    theme: "sepia",
  },
};

/**
 * 全画面ローディング状態（未キャッシュ話のオンデマンド取得中）
 */
export const Loading: Story = {
  name: "ローディング状態",
  args: {
    novel: null,
    chapter: null,
    isLoading: true,
  },
};

/**
 * エラー発生状態（下部オーバーレイ初期展開）
 */
export const ErrorState: Story = {
  name: "エラー状態",
  args: {
    novel: null,
    chapter: null,
    error:
      "エピソード本文の取得に失敗しました。ネットワークを確認してください。",
  },
};

/**
 * 空状態（作品未登録・エピソードなし・下部オーバーレイ初期展開）
 */
export const Empty: Story = {
  name: "空状態（未登録）",
  args: {
    novel: null,
    chapter: null,
    isLoading: false,
    error: null,
  },
};
