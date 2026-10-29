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

export const Initial: Story = {
  args: {
    keyword: "",
    items: [],
    isLoading: false,
  },
};

export const Loading: Story = {
  args: {
    keyword: "異世界",
    items: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    keyword: "存在しない作品名",
    items: [],
    isLoading: false,
  },
};

export const WithResults: Story = {
  args: {
    keyword: "異世界",
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

export const LoadingMore: Story = {
  args: {
    keyword: "異世界",
    items: [sampleSearchItem],
    hasNextPage: true,
    isLoadingMore: true,
  },
};

export const ErrorState: Story = {
  args: {
    keyword: "エラー作品",
    items: [],
    error: "検索結果の取得に失敗しました。ネットワーク接続を確認してください。",
  },
};
