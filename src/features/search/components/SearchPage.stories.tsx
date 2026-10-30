import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { SearchPage } from "./SearchPage";
import { sampleSearchItem } from "../types";

const meta: Meta<typeof SearchPage> = {
  title: "Features/Search/SearchPage",
  component: SearchPage,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    selectedSite: "kakuyomu",
    onSelectSite: fn(),
    keyword: "",
    onChangeKeyword: fn(),
    onSubmitSearch: fn(),
    selectedOrder: "weekly_ranking",
    onSelectOrder: fn(),
    selectedSerialStatus: "all",
    onSelectSerialStatus: fn(),
    selectedGenre: undefined,
    onSelectGenre: fn(),
    items: [],
    registeredWorkIds: new Set<string>(),
    addingWorkId: null,
    isLoading: false,
    isLoadingMore: false,
    hasNextPage: false,
    onLoadMore: fn(),
    error: null,
    onRetry: fn(),
    onAddNovel: fn(),
    onSelectCard: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SearchPage>;

/**
 * 検索画面（初期未検索状態）
 */
export const Initial: Story = {
  name: "初期未検索状態",
  args: {
    keyword: "",
    items: [],
    isLoading: false,
  },
};

/**
 * 検索画面（初回検索中ローディング表示）
 */
export const Loading: Story = {
  name: "検索中ローディング",
  args: {
    keyword: "異世界",
    items: [],
    isLoading: true,
  },
};

/**
 * 検索画面（検索結果0件空状態）
 */
export const Empty: Story = {
  name: "検索結果0件空状態",
  args: {
    keyword: "存在しない作品名",
    items: [],
    isLoading: false,
    hasSearched: true,
  },
};

/**
 * 検索画面（検索結果一覧・登録済み混在表示）
 */
export const WithResults: Story = {
  name: "検索結果一覧表示（登録済み混在）",
  args: {
    keyword: "異世界",
    hasSearched: true,
    items: [
      sampleSearchItem,
      {
        ...sampleSearchItem,
        remoteWorkId: "1177354054881162325",
        title: "現代ダンジョン配信者",
        author: "羽田遼亮",
        genre: "action",
        genreLabel: "現代ファンタジー",
        serialStatus: "completed",
        serialStatusLabel: "完結済",
        reviewPoints: 3420,
      },
    ],
    registeredWorkIds: new Set(["1177354054881162325"]),
    hasNextPage: true,
  },
};

/**
 * 検索画面（次ページ追加読み込み中）
 */
export const LoadingMore: Story = {
  name: "追加読み込み中状態",
  args: {
    keyword: "異世界",
    hasSearched: true,
    items: [sampleSearchItem],
    hasNextPage: true,
    isLoadingMore: true,
  },
};

/**
 * 検索画面（通信エラー状態）
 */
export const ErrorState: Story = {
  name: "通信エラー状態",
  args: {
    keyword: "エラー作品",
    hasSearched: true,
    items: [],
    error: "検索結果の取得に失敗しました。ネットワーク接続を確認してください。",
  },
};
