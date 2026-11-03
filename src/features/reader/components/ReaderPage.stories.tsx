import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ReaderPage } from "./ReaderPage";
import type {
  NovelRecord,
  ChapterRecord,
  ReaderPagingMode,
} from "../../../storage/types";

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
    pagingMode: "auto" as ReaderPagingMode,
    enableVolumeKeyPaging: false,
    currentPage: 1,
    totalPages: 1,
    isLoading: false,
    error: null,
    onPrevChapter: fn(),
    onNextChapter: fn(),
    onPageChange: fn(),
    onTotalPagesChange: fn(),
    onScrollProgressChange: fn(),
    onSelectTab: fn(),
    onBackToToc: fn(),
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
 * 上下オーバーレイ展開時
 */
export const OverlayOpen: Story = {
  name: "上下オーバーレイ展開時",
  args: {
    initialOverlayOpen: true,
  },
};

const longNovel: NovelRecord = {
  ...sampleNovel,
  title:
    "とても長くて画面幅に収まらない異世界転生した勇者が魔王を倒した後に始めるスローライフなセカンドライフ物語〜第1巻〜",
};

const longChapterTitle: ChapterRecord = {
  ...sampleChapter,
  title:
    "第1話 見知らぬ空と見知らぬ大地と二つの太陽が輝く広大な平原で目覚めた少年の戸惑いと決意",
};

/**
 * 長文タイトルでの上下オーバーレイ展開状態（1行固定省略保護）
 */
export const OverlayOpenLongTitle: Story = {
  name: "長文タイトルでの上下オーバーレイ展開状態",
  args: {
    novel: longNovel,
    chapter: longChapterTitle,
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

const longBodyHtml = Array.from({ length: 18 }, (_, i) => {
  const num = i + 1;
  return `<p>第${num}段落：青い空に、二つの<ruby><rb>太陽</rb><rp>(</rp><rt>たいよう</rt><rp>)</rp></ruby>が輝いていた。少年にとって、それは<em class="bouten">信じがたい光景</em>であった。見知らぬ世界の風が吹き抜け、青草の香りが鼻腔をくすぐる。彼は古びた魔導書を胸に抱き、地平線の彼方へと続く石畳の街道を一歩ずつ踏みしめて進んでいった。</p>`;
}).join("\n");

/**
 * ページめくりモード表示（実効 paged・2ページ目 / 全5ページ）
 */
export const Paged: Story = {
  name: "ページめくりモード（2ページ目 / 全5ページ）",
  args: {
    pagingMode: "paged" as ReaderPagingMode,
    currentPage: 2,
    totalPages: 5,
    chapter: {
      ...sampleChapter,
      bodyHtml: longBodyHtml,
    },
  },
};

/**
 * 上下連動オーバーレイ展開時（縦書きページめくり・シークバー表示）
 */
export const OverlayOpenPaged: Story = {
  name: "上下連動オーバーレイ展開時（縦書きページめくり・シークバー表示）",
  args: {
    initialOverlayOpen: true,
    pagingMode: "paged" as ReaderPagingMode,
    currentPage: 2,
    totalPages: 5,
    chapter: {
      ...sampleChapter,
      bodyHtml: longBodyHtml,
    },
  },
};

/**
 * 連続スクロールモード表示（実効 scroll）
 */
export const ScrollMode: Story = {
  name: "連続スクロールモード（scroll）",
  args: {
    pagingMode: "scroll" as ReaderPagingMode,
  },
};

/**
 * エピソード境界案内ヒント（次話へ）表示
 */
export const BoundaryHintNext: Story = {
  name: "エピソード境界ヒント（次話へ）",
  args: {
    pagingMode: "paged" as ReaderPagingMode,
    currentPage: 3,
    totalPages: 3,
    chapterIndex: 1,
    totalChapters: 3,
    initialBoundaryHint: "指を離して次の話へ",
    initialSlideOffsetPx: 40,
  },
};

/**
 * エピソード境界案内ヒント（前話へ）表示
 */
export const BoundaryHintPrev: Story = {
  name: "エピソード境界ヒント（前話へ）",
  args: {
    pagingMode: "paged" as ReaderPagingMode,
    currentPage: 1,
    totalPages: 3,
    chapterIndex: 2,
    totalChapters: 3,
    initialBoundaryHint: "指を離して前の話へ",
    initialSlideOffsetPx: -40,
  },
};

/**
 * 端2段階タップ案内ヒント（次話へ）表示
 */
export const TapBoundaryHintNext: Story = {
  name: "端2段階タップヒント（次話へ）",
  args: {
    pagingMode: "paged" as ReaderPagingMode,
    currentPage: 3,
    totalPages: 3,
    chapterIndex: 1,
    totalChapters: 3,
    initialBoundaryHint: "もう一度タップで次の話へ",
  },
};

/**
 * 端2段階タップ案内ヒント（前話へ）表示
 */
export const TapBoundaryHintPrev: Story = {
  name: "端2段階タップヒント（前話へ）",
  args: {
    pagingMode: "paged" as ReaderPagingMode,
    currentPage: 1,
    totalPages: 3,
    chapterIndex: 2,
    totalChapters: 3,
    initialBoundaryHint: "もう一度タップで前の話へ",
  },
};

/**
 * 連続スクロール端2段階スワイプ案内ヒント（次話へ）表示
 */
export const ScrollBoundaryHintNext: Story = {
  name: "連続スクロール端ヒント（次話へ）",
  args: {
    pagingMode: "scroll" as ReaderPagingMode,
    chapterIndex: 1,
    totalChapters: 3,
    initialBoundaryHint: "もう一度スワイプで次の話へ",
  },
};

/**
 * 連続スクロール端2段階スワイプ案内ヒント（前話へ）表示
 */
export const ScrollBoundaryHintPrev: Story = {
  name: "連続スクロール端ヒント（前話へ）",
  args: {
    pagingMode: "scroll" as ReaderPagingMode,
    chapterIndex: 2,
    totalChapters: 3,
    initialBoundaryHint: "もう一度スワイプで前の話へ",
  },
};

/**
 * カスタムフォント・画面余白（教科書体 Klee・余白 32px）表示（v0.5 Issue #169）
 */
export const CustomFontAndMargin: Story = {
  name: "カスタムフォント・余白（Klee / 32px）",
  args: {
    fontFamily: "klee",
    pageMarginPx: 32,
  },
};
