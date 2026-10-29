import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { RankingPage } from "./RankingPage";
import {
  sampleRankingItem1,
  sampleRankingItem2,
  sampleRankingItem3,
  sampleRankingItem4,
} from "../types";

const meta: Meta<typeof RankingPage> = {
  title: "Features/Ranking/RankingPage",
  component: RankingPage,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    selectedSite: "kakuyomu",
    onSelectSite: fn(),
    selectedPeriod: "weekly",
    onSelectPeriod: fn(),
    selectedGenre: undefined,
    onSelectGenre: fn(),
    items: [],
    registeredWorkIds: new Set<string>(),
    addingWorkId: null,
    isLoading: false,
    error: null,
    onRetry: fn(),
    onAddNovel: fn(),
    onSelectCard: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof RankingPage>;

export const WeeklyOverall: Story = {
  name: "総合週間ランキング（初期表示）",
  args: {
    selectedPeriod: "weekly",
    selectedGenre: undefined,
    items: [
      sampleRankingItem1,
      sampleRankingItem2,
      sampleRankingItem3,
      sampleRankingItem4,
    ],
    registeredWorkIds: new Set<string>(),
    isLoading: false,
  },
};

export const GenreFantasy: Story = {
  name: "ジャンル別ランキング（異世界ファンタジー・月間）",
  args: {
    selectedPeriod: "monthly",
    selectedGenre: "fantasy",
    items: [sampleRankingItem1],
    registeredWorkIds: new Set<string>(),
    isLoading: false,
  },
};

export const MixedRegistration: Story = {
  name: "上位順位バッジ・登録済み混在表示",
  args: {
    selectedPeriod: "weekly",
    selectedGenre: undefined,
    items: [
      sampleRankingItem1,
      sampleRankingItem2,
      sampleRankingItem3,
      sampleRankingItem4,
    ],
    registeredWorkIds: new Set([sampleRankingItem2.remoteWorkId]),
    addingWorkId: sampleRankingItem1.remoteWorkId,
    isLoading: false,
  },
};

export const Loading: Story = {
  name: "ランキング取得中ローディング",
  args: {
    selectedPeriod: "weekly",
    items: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  name: "ランキング0件空状態",
  args: {
    selectedPeriod: "daily",
    selectedGenre: "criticism",
    items: [],
    isLoading: false,
  },
};

export const ErrorState: Story = {
  name: "通信エラー状態",
  args: {
    selectedPeriod: "weekly",
    items: [],
    error:
      "ランキングの取得に失敗しました。ネットワーク接続を確認してください。",
  },
};
